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
        $query = InternetPlan::query()->with('creator:id,name,username,role,gb_balance')->orderBy('name');
        if ($request->boolean('active_only')) {
            $query->where('status', 'active');
        }
        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        $actor = $request->user();
        if ($actor && !$actor->isAdmin()) {
            $adminIds = \App\Models\User::where('role', 'admin')->pluck('id')->toArray();
            if ($actor->isReseller()) {
                $sellerIds = \App\Models\User::where('parent_id', $actor->id)->pluck('id')->toArray();
                $query->where(function ($q) use ($actor, $adminIds, $sellerIds) {
                    $q->whereNull('created_by')
                      ->orWhereIn('created_by', $adminIds)
                      ->orWhere('created_by', $actor->id)
                      ->orWhereIn('created_by', $sellerIds);
                });
            } else if ($actor->isSeller()) {
                $query->where(function ($q) use ($actor, $adminIds) {
                    $q->whereNull('created_by')
                      ->orWhereIn('created_by', $adminIds)
                      ->orWhere('created_by', $actor->parent_id)
                      ->orWhere('created_by', $actor->id);
                });
            }
        }

        return $this->ok($query->get());
    }

    public function show(InternetPlan $plan): JsonResponse
    {
        return $this->ok($plan);
    }

    /** Create — admin, reseller, and seller. */
    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request);
        if ($request->input('type') === 'hotspot') {
            $data['base_price'] = $data['base_price'] ?? 0;
            $data['selling_price'] = $data['selling_price'] ?? 0;
        }

        if (!empty($data['bandwidth_id'])) {
            $bw = \App\Models\Bandwidth::find($data['bandwidth_id']);
            if ($bw) {
                $short = fn ($u) => strtoupper($u) === 'MBPS' ? 'M' : (strtoupper($u) === 'KBPS' ? 'K' : $u);
                $data['bandwidth'] = "{$bw->rate_down}{$short($bw->rate_down_unit)}/{$bw->rate_up}{$short($bw->rate_up_unit)}";
            }
        }

        $data['created_by'] = $request->user()->id;

        return $this->created(InternetPlan::create($data), 'Plan created.');
    }

    public function update(Request $request, InternetPlan $plan): JsonResponse
    {
        if (!$request->user()->isAdmin() && $plan->created_by !== $request->user()->id) {
            return $this->fail('You do not have permission to modify this plan.', 403);
        }

        $data = $this->validateData($request, $plan->id);
        if ($request->input('type') === 'hotspot') {
            $data['base_price'] = $data['base_price'] ?? 0;
            $data['selling_price'] = $data['selling_price'] ?? 0;
        }

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
        if (!request()->user()->isAdmin() && $plan->created_by !== request()->user()->id) {
            return $this->fail('You do not have permission to delete this plan.', 403);
        }

        if ($plan->vouchers()->exists()) {
            return $this->fail('Cannot delete a plan that already has vouchers.', 422);
        }
        $plan->delete();

        return $this->ok(null, 'Plan deleted.');
    }

    private function validateData(Request $request, ?int $ignoreId = null): array
    {
        $user = $request->user();
        if ($user && !$user->isAdmin()) {
            if (!\App\Models\SystemPermission::isAllowed('customize_plan_bandwidth', $user->role)) {
                // If updating, verify they didn't change it. If creating, force defaults/null.
                if ($ignoreId) {
                    $original = InternetPlan::find($ignoreId);
                    if ($original && ($request->has('bandwidth_id') && $request->input('bandwidth_id') != $original->bandwidth_id)) {
                        throw \Illuminate\Validation\ValidationException::withMessages([
                            'bandwidth' => 'You do not have permission to customize bandwidth speed limits.'
                        ]);
                    }
                } else {
                    $request->merge(['bandwidth_id' => null, 'bandwidth' => null]);
                }
            }

            if (!\App\Models\SystemPermission::isAllowed('customize_plan_data_limit', $user->role)) {
                if ($ignoreId) {
                    $original = InternetPlan::find($ignoreId);
                    if ($original && ($request->has('data_gb') && $request->input('data_gb') != $original->data_gb)) {
                        throw \Illuminate\Validation\ValidationException::withMessages([
                            'data_gb' => 'You do not have permission to customize data/volume limits.'
                        ]);
                    }
                } else {
                    $request->merge(['data_gb' => null]);
                }
            }

            if (!\App\Models\SystemPermission::isAllowed('customize_plan_validity', $user->role)) {
                if ($ignoreId) {
                    $original = InternetPlan::find($ignoreId);
                    if ($original && ($request->has('validity_days') && $request->input('validity_days') != $original->validity_days)) {
                        throw \Illuminate\Validation\ValidationException::withMessages([
                            'validity_days' => 'You do not have permission to customize validity duration.'
                        ]);
                    }
                } else {
                    $request->merge(['validity_days' => 30]);
                }
            }
        }

        $isHotspot = $request->input('type') === 'hotspot';

        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['nullable', 'in:hotspot,pppoe'],
            'plan_type' => ['required', 'in:data,time,unlimited'],
            'bandwidth_id' => ['nullable', 'exists:bandwidths,id'],
            'bandwidth' => ['nullable', 'string', 'max:255'],
            'data_gb' => ['nullable', 'numeric', 'min:0'],
            'time_limit' => ['nullable', 'integer', 'min:0'],
            'validity_days' => ['required', 'integer', 'min:0'],
            'base_price' => [$isHotspot ? 'nullable' : 'required', 'numeric', 'min:0'],
            'selling_price' => [$isHotspot ? 'nullable' : 'required', 'numeric', 'min:0'],
            'api_nas' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:active,disabled'],
        ]);
    }
}
