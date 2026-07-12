<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Models\Voucher;
use App\Models\WalletTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();

        return $this->ok(match ($actor->role) {
            'admin' => $this->adminDashboard($actor),
            'reseller' => $this->resellerDashboard($actor),
            default => $this->sellerDashboard($actor),
        });
    }

    private function adminDashboard(User $admin): array
    {
        return [
            'role' => 'admin',
            'balances' => ['wallet' => $admin->wallet_balance, 'gb' => $admin->gb_balance, 'wallet_due' => $admin->wallet_due],
            'counts' => [
                'resellers' => User::where('role', 'reseller')->count(),
                'sellers' => User::where('role', 'seller')->count(),
            ],
            'today_sales' => (float) Invoice::where('sender_id', $admin->id)->whereDate('created_at', now()->toDateString())->sum('total_amount'),
            'wallet_distributed' => (float) WalletTransaction::where('type', 'load')->sum('amount'),
            'gb_distributed' => (float) DB::table('gb_transactions')->where('type', 'allocate')->where('from_user_id', $admin->id)->sum('gb_amount'),
            'vouchers' => $this->voucherBreakdown(Voucher::query()),
            'revenue' => (float) Invoice::where('sender_id', $admin->id)->sum('total_amount'),
            'outstanding_due' => (float) User::where('role', 'reseller')->sum('wallet_due'),
            'online' => $this->onlineCount(),
            'offline' => max(0, Voucher::where('status', 'active')->count() - $this->onlineCount()),
            'top_resellers' => $this->topByVoucherSales('reseller_id'),
            'recent_transactions' => WalletTransaction::with(['user', 'fromUser', 'toUser'])->latest()->limit(5)->get()->map(fn($t) => [
                'id' => $t->id,
                'user' => $t->user?->username,
                'type' => $t->type,
                'amount' => (float) $t->amount,
                'note' => $t->note ?? $t->reference ?? '—',
                'created_at' => $t->created_at->toIso8601String(),
            ])->all(),
        ];
    }

    private function resellerDashboard(User $reseller): array
    {
        $sellerIds = User::where('parent_id', $reseller->id)->pluck('id');

        return [
            'role' => 'reseller',
            'balances' => ['wallet' => $reseller->wallet_balance, 'gb' => $reseller->gb_balance, 'wallet_due' => $reseller->wallet_due],
            'counts' => ['sellers' => $sellerIds->count()],
            'today_sales' => (float) Invoice::where('sender_id', $reseller->id)->whereDate('created_at', now()->toDateString())->sum('total_amount'),
            'monthly_sales' => (float) Invoice::where('sender_id', $reseller->id)->whereMonth('created_at', now()->month)->whereYear('created_at', now()->year)->sum('total_amount'),
            'vouchers' => $this->voucherBreakdown(Voucher::where('reseller_id', $reseller->id)),
            'sales' => (float) Invoice::where('sender_id', $reseller->id)->sum('total_amount'),
            'outstanding_due' => (float) User::where('parent_id', $reseller->id)->sum('wallet_due'),
            'top_sellers' => $this->topByVoucherSales('seller_id', $sellerIds),
            'recent_wallet_transfers' => WalletTransaction::where('user_id', $reseller->id)->latest()->limit(5)->get()->map(fn($t) => [
                'id' => $t->id,
                'type' => $t->type,
                'amount' => (float) $t->amount,
                'note' => $t->note ?? $t->reference ?? '—',
                'created_at' => $t->created_at->toIso8601String(),
            ])->all(),
        ];
    }

    private function sellerDashboard(User $seller): array
    {
        $today = Voucher::where('seller_id', $seller->id)->whereDate('created_at', now()->toDateString());
        $todaySales = Voucher::where('seller_id', $seller->id)->whereIn('status', ['sold', 'active', 'expired'])->whereDate('sold_at', now()->toDateString());

        return [
            'role' => 'seller',
            'balances' => ['wallet' => $seller->wallet_balance, 'gb' => $seller->gb_balance, 'wallet_due' => $seller->wallet_due],
            'vouchers' => $this->voucherBreakdown(Voucher::where('seller_id', $seller->id)),
            'today' => [
                'vouchers' => (clone $today)->count(),
                'sales' => (float) $todaySales->sum('price'),
            ],
            'recent_customers' => Voucher::where('seller_id', $seller->id)->whereNotNull('customer_username')->latest()->limit(10)->get(['code', 'status', 'customer_username', 'price', 'activated_at', 'sold_at'])->all(),
        ];
    }

    /** {generated, used, remaining} plus per-status counts. */
    private function voucherBreakdown($query): array
    {
        $byStatus = (clone $query)->select('status', DB::raw('count(*) as c'))->groupBy('status')->pluck('c', 'status');
        $total = (int) $byStatus->sum();
        $used = (int) ($byStatus['active'] ?? 0) + (int) ($byStatus['expired'] ?? 0);

        return [
            'total' => $total,
            'by_status' => $byStatus,
            'used' => $used,
            'remaining' => $total - $used,
        ];
    }

    private function onlineCount(): int
    {
        return (int) DB::table('radacct')->whereNull('acctstoptime')->distinct()->count('username');
    }

    private function topByVoucherSales(string $column, $restrictIds = null): array
    {
        $q = Voucher::query()->whereNotNull($column)
            ->select($column, DB::raw('count(*) as vouchers'), DB::raw('sum(price) as revenue'))
            ->groupBy($column)->orderByDesc('revenue')->limit(5);
        if ($restrictIds !== null) {
            $q->whereIn($column, $restrictIds);
        }
        $rows = $q->get();
        $names = User::whereIn('id', $rows->pluck($column))->pluck('username', 'id');

        return $rows->map(fn ($r) => [
            'user' => $names[$r->$column] ?? "#{$r->$column}",
            'vouchers' => (int) $r->vouchers,
            'revenue' => (float) $r->revenue,
        ])->all();
    }
}
