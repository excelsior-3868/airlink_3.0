<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InternetPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlanController extends Controller
{
    /** List plans — all roles. */
    public function index(Request $request): JsonResponse
    {
        $query = InternetPlan::query()->orderBy('name');
        if ($request->boolean('active_only')) {
            $query->where('status', 'active');
        }
        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        return $this->ok($query->get());
    }

    public function show(InternetPlan $plan): JsonResponse
    {
        return $this->ok($plan);
    }

    /** Create — admin only (enforced by route middleware). */
    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request);
        if (!empty($data['bandwidth_id'])) {
            $bw = \App\Models\Bandwidth::find($data['bandwidth_id']);
            if ($bw) {
                $short = fn ($u) => strtoupper($u) === 'MBPS' ? 'M' : (strtoupper($u) === 'KBPS' ? 'K' : $u);
                $data['bandwidth'] = "{$bw->rate_down}{$short($bw->rate_down_unit)}/{$bw->rate_up}{$short($bw->rate_up_unit)}";
            }
        }

        return $this->created(InternetPlan::create($data), 'Plan created.');
    }

    public function update(Request $request, InternetPlan $plan): JsonResponse
    {
        $data = $this->validateData($request, $plan->id);
        if (!empty($data['bandwidth_id'])) {
            $bw = \App\Models\Bandwidth::find($data['bandwidth_id']);
            if ($bw) {
                $short = fn ($u) => strtoupper($u) === 'MBPS' ? 'M' : (strtoupper($u) === 'KBPS' ? 'K' : $u);
                $data['bandwidth'] = "{$bw->rate_down}{$short($bw->rate_down_unit)}/{$bw->rate_up}{$short($bw->rate_up_unit)}";
            }
        }

        $plan->update($data);

        return $this->ok($plan, 'Plan updated.');
    }

    public function destroy(InternetPlan $plan): JsonResponse
    {
        if ($plan->vouchers()->exists()) {
            return $this->fail('Cannot delete a plan that already has vouchers.', 422);
        }
        $plan->delete();

        return $this->ok(null, 'Plan deleted.');
    }

    private function validateData(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['nullable', 'in:hotspot,pppoe'],
            'plan_type' => ['required', 'in:data,time,unlimited'],
            'bandwidth_id' => ['nullable', 'exists:bandwidths,id'],
            'bandwidth' => ['nullable', 'string', 'max:255'],
            'data_gb' => ['nullable', 'numeric', 'min:0'],
            'time_limit' => ['nullable', 'integer', 'min:0'],
            'validity_days' => ['required', 'integer', 'min:0'],
            'base_price' => ['required', 'numeric', 'min:0'],
            'selling_price' => ['required', 'numeric', 'min:0'],
            'api_nas' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:active,disabled'],
        ]);
    }
}
