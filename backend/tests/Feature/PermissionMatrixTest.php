<?php

namespace Tests\Feature;

use App\Models\SystemPermission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PermissionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private function planPayload(): array
    {
        return ['name' => 'X', 'plan_type' => 'data', 'data_gb' => 10, 'validity_days' => 30, 'base_price' => 100, 'selling_price' => 150, 'bandwidth' => '10M/10M', 'status' => 'active'];
    }

    public function test_dynamic_permission_enforcement(): void
    {
        $admin = $this->makeUser('admin');
        $reseller = $this->makeUser('reseller', ['wallet_balance' => 1000, 'gb_balance' => 100]);

        // Seed default permission records
        $this->seed();

        // 1. Initially, Reseller cannot create plans (403)
        $this->actingAs($reseller, 'sanctum')
            ->postJson('/api/plans', $this->planPayload())
            ->assertStatus(403);

        // 2. Admin updates the permission matrix to allow resellers to create plans
        $permId = SystemPermission::where('feature', 'create_plan')->firstOrFail()->id;
        
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/permissions', [
                'permissions' => [
                    ['id' => $permId, 'admin' => true, 'reseller' => true, 'seller' => false]
                ]
            ])
            ->assertOk();

        // 3. Reseller can now successfully create plans (201)!
        $this->actingAs($reseller, 'sanctum')
            ->postJson('/api/plans', $this->planPayload())
            ->assertStatus(201);
    }

    public function test_unauthorized_user_cannot_save_permissions(): void
    {
        $reseller = $this->makeUser('reseller');

        $this->actingAs($reseller, 'sanctum')
            ->postJson('/api/permissions', ['permissions' => []])
            ->assertStatus(403);
    }
}
