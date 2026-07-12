<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemPermission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PermissionController extends Controller
{
    /**
     * Get the full permission matrix. Accessible to all users for rendering.
     */
    public function index(): JsonResponse
    {
        return $this->ok(SystemPermission::orderBy('id')->get());
    }

    /**
     * Update the permission matrix. Restricted to Admin only.
     */
    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'permissions' => ['required', 'array'],
            'permissions.*.id' => ['required', 'integer', 'exists:system_permissions,id'],
            'permissions.*.admin' => ['required', 'boolean'],
            'permissions.*.reseller' => ['required', 'boolean'],
            'permissions.*.seller' => ['required', 'boolean'],
        ]);

        foreach ($request->input('permissions') as $p) {
            $perm = SystemPermission::findOrFail($p['id']);
            $perm->update([
                'admin' => $p['admin'],
                'reseller' => $p['reseller'],
                'seller' => $p['seller'],
            ]);
        }

        return $this->ok(null, 'Permission matrix updated successfully.');
    }
}
