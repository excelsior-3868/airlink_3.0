<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransactionController extends Controller
{
    /**
     * Unified transaction feed across wallet, GB, invoice and payment ledgers.
     *
     * Visibility follows the user hierarchy: admin sees everything, a reseller
     * sees itself + its own sellers, and a seller sees only its own rows.
     */
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $visibleIds = User::query()->visibleTo($actor)->pluck('id')->all();

        // Optional drill-down to a single user (must be within the actor's scope).
        $userId = $request->input('user_id');
        if ($userId) {
            if (! in_array((int) $userId, $visibleIds)) {
                return $this->fail('Unauthorized access to user transaction history.', 403);
            }
            $scopeIds = [(int) $userId];
        } else {
            $scopeIds = $visibleIds;
        }

        $source = $request->input('source'); // wallet | gb | invoice | payment | null (all)

        $parts = [];

        if (! $source || $source === 'wallet') {
            $parts[] = DB::table('wallet_transactions')
                ->selectRaw("'wallet' as source, id as source_id, type as txn_type, amount, 'rs' as unit, balance_after, user_id as account_id, from_user_id, to_user_id, reference, note, NULL as status, created_at")
                ->whereIn('user_id', $scopeIds);
        }

        if (! $source || $source === 'gb') {
            $parts[] = DB::table('gb_transactions')
                ->selectRaw("'gb' as source, id as source_id, type as txn_type, gb_amount as amount, 'gb' as unit, balance_after, user_id as account_id, from_user_id, to_user_id, reference, note, NULL as status, created_at")
                ->whereIn('user_id', $scopeIds);
        }

        if (! $source || $source === 'invoice') {
            $parts[] = DB::table('invoices')
                ->selectRaw("'invoice' as source, id as source_id, status as txn_type, total_amount as amount, 'rs' as unit, NULL as balance_after, receiver_id as account_id, sender_id as from_user_id, receiver_id as to_user_id, invoice_number as reference, NULL as note, status, created_at")
                ->where(fn ($q) => $q->whereIn('sender_id', $scopeIds)->orWhereIn('receiver_id', $scopeIds));
        }

        if (! $source || $source === 'payment') {
            $parts[] = DB::table('payments')
                ->selectRaw("'payment' as source, id as source_id, 'payment' as txn_type, amount, 'rs' as unit, NULL as balance_after, sender_id as account_id, sender_id as from_user_id, receiver_id as to_user_id, NULL as reference, note, NULL as status, payment_date as created_at")
                ->where(fn ($q) => $q->whereIn('sender_id', $scopeIds)->orWhereIn('receiver_id', $scopeIds));
        }

        if (empty($parts)) {
            return $this->fail('Invalid transaction source filter.', 422);
        }

        $union = array_shift($parts);
        foreach ($parts as $part) {
            $union->unionAll($part);
        }

        $paginated = DB::query()
            ->fromSub($union, 't')
            ->orderByDesc('created_at')
            ->orderByDesc('source_id')
            ->paginate($request->integer('per_page', 20));

        // Resolve usernames for the accounts referenced on this page.
        $rows = collect($paginated->items());
        $ids = $rows->flatMap(fn ($r) => [$r->account_id, $r->from_user_id, $r->to_user_id])
            ->filter()
            ->unique()
            ->values();
        $names = User::whereIn('id', $ids)->pluck('username', 'id');

        $paginated->setCollection($rows->map(fn ($r) => [
            'id' => $r->source . '-' . $r->source_id,
            'source' => $r->source,
            'type' => $r->txn_type,
            'amount' => (float) $r->amount,
            'unit' => $r->unit,
            'balance_after' => $r->balance_after !== null ? (float) $r->balance_after : null,
            'account' => $names[$r->account_id] ?? null,
            'from' => $r->from_user_id ? ($names[$r->from_user_id] ?? null) : null,
            'to' => $r->to_user_id ? ($names[$r->to_user_id] ?? null) : null,
            'reference' => $r->reference,
            'note' => $r->note,
            'status' => $r->status,
            'created_at' => $r->created_at,
        ]));

        return $this->ok($paginated);
    }
}
