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

        // 1. Invoices (GB Allocations to Sellers)
        $invoiceTotal = (float) Invoice::where('sender_id', $reseller->id)->sum('total_amount');
        $invoiceToday = (float) Invoice::where('sender_id', $reseller->id)->whereDate('created_at', now()->toDateString())->sum('total_amount');
        $invoiceMonth = (float) Invoice::where('sender_id', $reseller->id)->whereMonth('created_at', now()->month)->whereYear('created_at', now()->year)->sum('total_amount');

        // 2. Direct Voucher Sales (Reseller direct)
        $voucherTotal = (float) Voucher::where('reseller_id', $reseller->id)
            ->whereNull('seller_id')
            ->whereIn('status', ['sold', 'active', 'expired'])
            ->sum('price');
        $voucherToday = (float) Voucher::where('reseller_id', $reseller->id)
            ->whereNull('seller_id')
            ->whereIn('status', ['sold', 'active', 'expired'])
            ->whereDate('sold_at', now()->toDateString())
            ->sum('price');
        $voucherMonth = (float) Voucher::where('reseller_id', $reseller->id)
            ->whereNull('seller_id')
            ->whereIn('status', ['sold', 'active', 'expired'])
            ->whereMonth('sold_at', now()->month)
            ->whereYear('sold_at', now()->year)
            ->sum('price');

        $totalSales = $invoiceTotal + $voucherTotal;
        $todaySales = $invoiceToday + $voucherToday;
        $monthlySales = $invoiceMonth + $voucherMonth;

        // 3. Unified recent transactions
        // A. Wallet Transactions (loads/payments)
        $walletTx = WalletTransaction::where('user_id', $reseller->id)
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn($t) => [
                'id' => 'wxt_' . $t->id,
                'type' => $t->type,
                'amount' => (float) $t->amount,
                'note' => $t->note ?? $t->reference ?? '—',
                'is_positive' => $t->type === 'load' || $t->type === 'transfer',
                'created_at' => $t->created_at,
            ]);

        // B. Invoices (sales to sellers)
        $invoicesTx = Invoice::with('receiver')
            ->where('sender_id', $reseller->id)
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn($inv) => [
                'id' => 'inv_' . $inv->id,
                'type' => 'GB Allocation',
                'amount' => (float) $inv->total_amount,
                'note' => "Allocated " . number_format($inv->gb_amount) . " GB to " . ($inv->receiver?->username ?? 'Seller'),
                'is_positive' => true,
                'created_at' => $inv->created_at,
            ]);

        // C. Direct Voucher Sales
        $vouchersTx = Voucher::with('plan')
            ->where('reseller_id', $reseller->id)
            ->whereNull('seller_id')
            ->whereIn('status', ['sold', 'active', 'expired'])
            ->whereNotNull('sold_at')
            ->latest('sold_at')
            ->limit(5)
            ->get()
            ->map(fn($v) => [
                'id' => 'vch_' . $v->id,
                'type' => 'Voucher Sale',
                'amount' => (float) $v->price,
                'note' => "Sold " . ($v->plan?->name ?? 'Voucher') . " (" . $v->code . ")" . ($v->customer_username ? " to {$v->customer_username}" : ""),
                'is_positive' => true,
                'created_at' => $v->sold_at,
            ]);

        // Merge, sort descending by transaction date, take 5
        $mergedTransactions = collect()
            ->concat($walletTx)
            ->concat($invoicesTx)
            ->concat($vouchersTx)
            ->sortByDesc('created_at')
            ->take(5)
            ->map(fn($tx) => [
                'id' => $tx['id'],
                'type' => $tx['type'],
                'amount' => $tx['amount'],
                'note' => $tx['note'],
                'is_positive' => $tx['is_positive'],
                'created_at' => $tx['created_at']->toIso8601String(),
            ])
            ->values()
            ->all();

        $directVouchers = Voucher::where('reseller_id', $reseller->id)
            ->whereNull('seller_id')
            ->whereIn('status', ['sold', 'active', 'expired'])
            ->get();

        $retailProfit = $directVouchers->sum(function ($v) {
            return (float) $v->price - (float) $v->base_price;
        });

        $gbPurchased = (float) Invoice::where('receiver_id', $reseller->id)->sum('gb_amount');
        $gbAllocated = (float) Invoice::where('sender_id', $reseller->id)->sum('gb_amount');
        $revenueSellers = (float) Invoice::where('sender_id', $reseller->id)->sum('total_amount');
        $packagesCount = \App\Models\InternetPlan::where('created_by', $reseller->id)->count();

        return [
            'role' => 'reseller',
            'balances' => ['wallet' => $reseller->wallet_balance, 'gb' => $reseller->gb_balance, 'wallet_due' => $reseller->wallet_due],
            'counts' => [
                'sellers' => $sellerIds->count(),
                'packages' => $packagesCount,
            ],
            'gb_purchased' => $gbPurchased,
            'gb_allocated' => $gbAllocated,
            'revenue_sellers' => $revenueSellers,
            'voucher_sales' => $voucherTotal,
            'retail_profit' => (float) $retailProfit,
            'today_sales' => $todaySales,
            'monthly_sales' => $monthlySales,
            'vouchers' => $this->voucherBreakdown(Voucher::where('reseller_id', $reseller->id)),
            'sales' => $totalSales,
            'outstanding_due' => (float) User::where('parent_id', $reseller->id)->sum('wallet_due'),
            'top_sellers' => $this->topByVoucherSales('seller_id', $sellerIds),
            'recent_wallet_transfers' => $mergedTransactions,
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

    private function voucherBreakdown($query): array
    {
        $byStatus = (clone $query)->select('status', DB::raw('count(*) as c'))->groupBy('status')->pluck('c', 'status');
        $total = (int) $byStatus->sum();
        $used = (int) ($byStatus['active'] ?? 0) + (int) ($byStatus['expired'] ?? 0);
        $last7Days = (clone $query)->where('created_at', '>=', now()->subDays(7))->count();

        return [
            'total' => $total,
            'by_status' => $byStatus,
            'used' => $used,
            'remaining' => $total - $used,
            'last_7_days' => $last7Days,
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
