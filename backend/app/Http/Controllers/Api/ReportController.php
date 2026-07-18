<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /**
     * Used-voucher report: per-package generated / used / remaining, scoped to
     * the caller's tree and the spec's filter set (date, package, reseller,
     * seller, status).
     */
    public function packageSummary(Request $request): JsonResponse
    {
        $q = $this->scoped($request);

        $rows = (clone $q)
            ->join('internet_plans as p', 'p.id', '=', 'vouchers.plan_id')
            ->select('p.id as plan_id', 'p.name as plan', 'vouchers.status', DB::raw('count(*) as c'), DB::raw('sum(vouchers.price) as revenue'))
            ->groupBy('p.id', 'p.name', 'vouchers.status')
            ->get();

        $summary = [];
        foreach ($rows as $r) {
            $summary[$r->plan_id] ??= [
                'plan_id' => $r->plan_id, 'plan' => $r->plan,
                'generated' => 0, 'used' => 0, 'remaining' => 0, 'revenue' => 0,
                'by_status' => ['new' => 0, 'sold' => 0, 'active' => 0, 'used' => 0, 'expired' => 0, 'disabled' => 0],
            ];
            $summary[$r->plan_id]['generated'] += (int) $r->c;
            $summary[$r->plan_id]['by_status'][$r->status] = (int) $r->c;
            if (in_array($r->status, ['sold', 'active', 'used', 'expired'], true)) {
                $summary[$r->plan_id]['revenue'] += (float) $r->revenue;
            }
            // "Used" = vouchers that are fully used/redeemed or expired.
            if (in_array($r->status, ['used', 'expired'], true)) {
                $summary[$r->plan_id]['used'] += (int) $r->c;
            }
        }
        $totalsByStatus = ['new' => 0, 'sold' => 0, 'active' => 0, 'used' => 0, 'expired' => 0, 'disabled' => 0];
        foreach ($summary as &$s) {
            $s['remaining'] = $s['generated'] - $s['used'];
            foreach ($s['by_status'] as $status => $count) {
                $totalsByStatus[$status] += $count;
            }
        }

        return $this->ok([
            'packages' => array_values($summary),
            'totals' => [
                'generated' => array_sum(array_column($summary, 'generated')),
                'used' => array_sum(array_column($summary, 'used')),
                'remaining' => array_sum(array_column($summary, 'remaining')),
                'revenue' => array_sum(array_column($summary, 'revenue')),
                'by_status' => $totalsByStatus,
            ],
        ]);
    }

    /** Base voucher query scoped to the actor + shared report filters. */
    private function scoped(Request $request)
    {
        $actor = $request->user();
        $q = Voucher::query();

        if ($actor->isReseller()) {
            $q->where('reseller_id', $actor->id);
        } elseif ($actor->isSeller()) {
            $q->where('seller_id', $actor->id);
        }

        if ($p = $request->query('plan_id')) {
            $q->where('plan_id', $p);
        }
        if ($s = $request->query('status')) {
            $q->where('status', $s);
        }
        if (($rid = $request->query('reseller_id')) && $actor->isAdmin()) {
            $q->where('reseller_id', $rid);
        }
        if ($sid = $request->query('seller_id')) {
            $q->where('seller_id', $sid);
        }
        if ($code = $request->query('code')) {
            $q->where('code', 'like', "%$code%");
        }
        if ($batch = $request->query('batch')) {
            $q->whereHas('batch', fn ($x) => $x->where('batch_code', 'like', "%$batch%"));
        }
        if ($cu = $request->query('customer_username')) {
            $q->where('customer_username', 'like', "%$cu%");
        }
        if ($from = $request->query('from')) {
            $q->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $q->whereDate('created_at', '<=', $to);
        }

        return $q;
    }
}
