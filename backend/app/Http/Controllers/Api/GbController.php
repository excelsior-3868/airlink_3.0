<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GbTransaction;
use App\Models\User;
use App\Services\GbService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GbController extends Controller
{
    public function __construct(private GbService $gb) {}

    /** Allocate GB quota to a direct downline user. */
    public function allocate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'gb_amount' => ['required', 'numeric', 'min:0.001'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $to = User::findOrFail($data['user_id']);
        $this->gb->allocate(
            $request->user(),
            $to,
            (float) $data['gb_amount'],
            $data['note'] ?? null,
            (float) ($data['paid_amount'] ?? 0),
        );

        $fresh = $to->fresh();
        return $this->ok([
            'balance' => $fresh->gb_balance,
            'wallet_due' => $fresh->wallet_due,
        ], 'GB allocated.');
    }

    public function transactions(Request $request): JsonResponse
    {
        $actor = $request->user();
        $visibleIds = User::query()->visibleTo($actor)->pluck('id');

        $userId = $request->input('user_id');
        $query = GbTransaction::query()
            ->with(['user:id,username', 'fromUser:id,username', 'toUser:id,username'])
            ->latest();

        if ($userId) {
            if (! in_array($userId, $visibleIds->all())) {
                return $this->fail('Unauthorized access to user transaction history.', 403);
            }
            $query->where(function($q) use ($userId) {
                $q->where('user_id', $userId)
                  ->orWhere('from_user_id', $userId)
                  ->orWhere('to_user_id', $userId);
            });
        } else {
            $query->whereIn('user_id', $visibleIds);
        }

        $tx = $query->paginate($request->integer('per_page', 20));

        return $this->ok($tx);
    }
}
