<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bandwidth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BandwidthController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Bandwidth::query()->orderBy('name');
        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->input('search') . '%');
        }
        return $this->ok($query->get());
    }

    public function show(Bandwidth $bandwidth): JsonResponse
    {
        return $this->ok($bandwidth);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request);
        return $this->created(Bandwidth::create($data), 'Bandwidth created.');
    }

    public function update(Request $request, Bandwidth $bandwidth): JsonResponse
    {
        $data = $this->validateData($request, $bandwidth->id);
        $bandwidth->update($data);

        // Update referencing plans' cached bandwidth string
        foreach ($bandwidth->plans as $plan) {
            $short = fn ($u) => strtoupper($u) === 'MBPS' ? 'M' : (strtoupper($u) === 'KBPS' ? 'K' : $u);
            $plan->update([
                'bandwidth' => "{$bandwidth->rate_down}{$short($bandwidth->rate_down_unit)}/{$bandwidth->rate_up}{$short($bandwidth->rate_up_unit)}"
            ]);
        }

        return $this->ok($bandwidth, 'Bandwidth updated.');
    }

    public function destroy(Bandwidth $bandwidth): JsonResponse
    {
        if ($bandwidth->plans()->exists()) {
            return $this->fail('Cannot delete bandwidth because it is used by plans.', 422);
        }
        $bandwidth->delete();
        return $this->ok(null, 'Bandwidth deleted.');
    }

    private function validateData(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:bandwidths,name,' . $ignoreId],
            'rate_down' => ['required', 'integer', 'min:1'],
            'rate_down_unit' => ['required', 'in:Kbps,Mbps'],
            'rate_up' => ['required', 'integer', 'min:1'],
            'rate_up_unit' => ['required', 'in:Kbps,Mbps'],
        ]);
    }
}
