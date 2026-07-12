<?php

namespace App\Services;

use App\Models\GbTransaction;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class GbService
{
    /**
     * Allocate GB quota down the chain (admin→reseller or reseller→seller).
     * Deducts the allocator, credits the receiver, increases receiver's wallet_due, and creates an invoice.
     */
    public function allocate(User $from, User $to, float $gb, ?string $note = null): void
    {
        if ($gb <= 0) {
            throw ValidationException::withMessages(['gb_amount' => 'GB amount must be greater than zero.']);
        }
        if ($to->parent_id !== $from->id) {
            throw ValidationException::withMessages(['user_id' => 'You can only allocate GB to your own direct downline.']);
        }

        DB::transaction(function () use ($from, $to, $gb, $note) {
            $allocator = User::whereKey($from->id)->lockForUpdate()->first();
            $receiver = User::whereKey($to->id)->lockForUpdate()->first();

            if ((float) $allocator->gb_balance < $gb) {
                throw ValidationException::withMessages(['gb_amount' => 'Not enough GB balance.']);
            }

            // Deduct / Credit GB balance
            $allocator->decrement('gb_balance', $gb);
            $receiver->increment('gb_balance', $gb);

            // Stacking financial invoice & due
            $rate = (float) $receiver->gb_rate;
            $totalAmount = $gb * $rate;
            $receiver->increment('wallet_due', $totalAmount);

            $allocator->refresh();
            $receiver->refresh();

            // Create Invoice
            $invoiceNumber = 'INV-' . now()->format('Ymd') . '-' . strtoupper(Str::random(6));
            Invoice::create([
                'invoice_number' => $invoiceNumber,
                'sender_id' => $allocator->id,
                'receiver_id' => $receiver->id,
                'gb_amount' => $gb,
                'rate' => $rate,
                'total_amount' => $totalAmount,
                'status' => 'due',
                'paid_amount' => 0.00,
            ]);

            GbTransaction::create([
                'user_id' => $allocator->id, 'type' => 'allocate', 'gb_amount' => $gb,
                'balance_after' => $allocator->gb_balance, 'to_user_id' => $receiver->id,
                'note' => $note ?? "Allocated to {$receiver->username} at Rs {$rate}/GB",
            ]);
            GbTransaction::create([
                'user_id' => $receiver->id, 'type' => 'allocate', 'gb_amount' => $gb,
                'balance_after' => $receiver->gb_balance, 'from_user_id' => $allocator->id,
                'note' => $note ?? "Allocated from {$allocator->username} at Rs {$rate}/GB",
            ]);
        });
    }

    /** Deduct GB for voucher generation (used by VoucherService in M3). */
    public function deduct(User $user, float $gb, string $reference, ?string $note = null): void
    {
        $u = User::whereKey($user->id)->lockForUpdate()->first();
        if ((float) $u->gb_balance < $gb) {
            throw ValidationException::withMessages(['gb' => 'Not enough GB balance.']);
        }
        $u->decrement('gb_balance', $gb);
        $u->refresh();
        GbTransaction::create([
            'user_id' => $u->id, 'type' => 'deduct', 'gb_amount' => $gb,
            'balance_after' => $u->gb_balance, 'reference' => $reference, 'note' => $note,
        ]);
    }
}
