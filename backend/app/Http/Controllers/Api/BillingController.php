<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BillingController extends Controller
{
    public function __construct(private PaymentService $paymentService) {}

    /** List invoices visible to the authenticated user. */
    public function invoices(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Invoice::query()->with(['sender:id,username,name', 'receiver:id,username,name']);

        if ($user->role === 'reseller') {
            $query->where(function ($q) use ($user) {
                $q->where('sender_id', $user->id)->orWhere('receiver_id', $user->id);
            });
        } elseif ($user->role === 'seller') {
            $query->where('receiver_id', $user->id);
        }

        $invoices = $query->latest()->paginate($request->integer('per_page', 20));
        return $this->ok($invoices);
    }

    /** List payments visible to the authenticated user. */
    public function payments(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Payment::query()->with(['sender:id,username,name', 'receiver:id,username,name']);

        if ($user->role === 'reseller') {
            $query->where(function ($q) use ($user) {
                $q->where('sender_id', $user->id)->orWhere('receiver_id', $user->id);
            });
        } elseif ($user->role === 'seller') {
            $query->where('sender_id', $user->id);
        }

        $payments = $query->latest()->paginate($request->integer('per_page', 20));
        return $this->ok($payments);
    }

    /** Collect a payment from a direct downline user. */
    public function collect(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $payer = User::findOrFail($data['user_id']);
        $payment = $this->paymentService->collect(
            $request->user(),
            $payer,
            (float) $data['amount'],
            $data['note'] ?? null
        );

        return $this->ok([
            'payment' => $payment,
            'wallet_due' => $payer->fresh()->wallet_due
        ], 'Payment collected successfully.');
    }
}
