<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RbacTest extends TestCase
{
    use RefreshDatabase;

    private function planPayload(): array
    {
        return ['name' => 'X', 'plan_type' => 'data', 'data_gb' => 1, 'validity_days' => 1, 'base_price' => 1, 'selling_price' => 1];
    }

    public function test_reseller_cannot_create_plan(): void
    {
        $this->actingAs($this->makeUser('reseller'), 'sanctum')
            ->postJson('/api/plans', $this->planPayload())->assertStatus(403);
    }

    public function test_admin_can_create_plan(): void
    {
        $this->actingAs($this->makeUser('admin'), 'sanctum')
            ->postJson('/api/plans', $this->planPayload())->assertStatus(201);
    }

    public function test_seller_cannot_create_seller(): void
    {
        $this->actingAs($this->makeUser('seller'), 'sanctum')
            ->postJson('/api/sellers', ['name' => 'S', 'username' => 'x1', 'password' => 'secret1'])->assertStatus(403);
    }

    public function test_seller_cannot_load_wallet(): void
    {
        $this->actingAs($this->makeUser('seller'), 'sanctum')
            ->postJson('/api/wallet/load', ['user_id' => 1, 'amount' => 100])->assertStatus(403);
    }
}
