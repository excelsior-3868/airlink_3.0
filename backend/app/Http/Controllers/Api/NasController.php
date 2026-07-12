<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NasDevice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * MikroTik router / NAS registry (admin-only). Each device is mirrored into the
 * standard FreeRADIUS `nas` table so RADIUS clients can be DB-managed
 * (read_clients) instead of living only in clients.conf.
 */
class NasController extends Controller
{
    public function index(): JsonResponse
    {
        return $this->ok(NasDevice::orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request);
        $device = null;
        DB::transaction(function () use ($data, &$device) {
            $device = NasDevice::create($data);
            $this->syncToRadius($device);
        });

        return $this->created($device, 'NAS device created.');
    }

    public function update(Request $request, NasDevice $nas): JsonResponse
    {
        $data = $this->validateData($request, $nas->id);
        DB::transaction(function () use ($nas, $data) {
            $oldName = $nas->nasname;
            $nas->update($data);
            DB::table('nas')->where('nasname', $oldName)->delete();
            $this->syncToRadius($nas);
        });

        return $this->ok($nas, 'NAS device updated.');
    }

    public function destroy(NasDevice $nas): JsonResponse
    {
        DB::transaction(function () use ($nas) {
            DB::table('nas')->where('nasname', $nas->nasname)->delete();
            $nas->delete();
        });

        return $this->ok(null, 'NAS device deleted.');
    }

    /** Upsert the matching row in the FreeRADIUS `nas` table. */
    private function syncToRadius(NasDevice $d): void
    {
        DB::table('nas')->updateOrInsert(
            ['nasname' => $d->nasname],
            [
                'shortname' => $d->shortname ?: $d->name,
                'type' => $d->type ?: 'other',
                'secret' => $d->secret,
                'description' => $d->description ?: 'Airlink NAS',
            ],
        );
    }

    private function validateData(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'nasname' => ['required', 'string', 'max:255'],
            'shortname' => ['nullable', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:50'],
            'secret' => ['required', 'string', 'max:255'],
            'api_ip' => ['nullable', 'string', 'max:255'],
            'api_username' => ['nullable', 'string', 'max:255'],
            'api_password' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:active,disabled'],
        ]);
    }
}
