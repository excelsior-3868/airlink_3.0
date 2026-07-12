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
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $to = User::findOrFail($data['user_id']);
        $this->gb->allocate($request->user(), $to, (float) $data['gb_amount'], $data['note'] ?? null);

        return $this->ok(['balance' => $to->fresh()->gb_balance], 'GB allocated.');
    }

    public function transactions(Request $request): JsonResponse
    {
        $actor = $request->user();
        $visibleIds = User::query()->visibleTo($actor)->pluck('id');

        $tx = GbTransaction::whereIn('user_id', $visibleIds)
            ->with(['user:id,username', 'fromUser:id,username', 'toUser:id,username'])
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return $this->ok($tx);
    }
}
