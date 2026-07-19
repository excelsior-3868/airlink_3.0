<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WalletGbTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_loads_reseller_wallet_and_balances_move(): void
    {
        $admin = $this->makeUser('admin', ['wallet_balance' => 1000]);
        $reseller = $this->makeUser('reseller', ['parent_id' => $admin->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/wallet/load', ['user_id' => $reseller->id, 'amount' => 400])
            ->assertOk();

        $this->assertEquals(600, $admin->fresh()->wallet_balance);
        $this->assertEquals(400, $reseller->fresh()->wallet_balance);
    }

    public function test_wallet_load_rejects_insufficient_balance(): void
    {
        $admin = $this->makeUser('admin', ['wallet_balance' => 100]);
        $reseller = $this->makeUser('reseller', ['parent_id' => $admin->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/wallet/load', ['user_id' => $reseller->id, 'amount' => 500])
            ->assertStatus(422);

        $this->assertEquals(100, $admin->fresh()->wallet_balance);
        $this->assertEquals(0, $reseller->fresh()->wallet_balance);
    }

    public function test_cannot_load_non_direct_downline(): void
    {
        $admin = $this->makeUser('admin', ['wallet_balance' => 1000]);
        $other = $this->makeUser('reseller'); // parent_id null → not admin's child

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/wallet/load', ['user_id' => $other->id, 'amount' => 100])
            ->assertStatus(422);
    }

    public function test_gb_allocation_moves_quota_and_guards_balance(): void
    {
        $admin = $this->makeUser('admin', ['gb_balance' => 100]);
        $reseller = $this->makeUser('reseller', ['parent_id' => $admin->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/gb/allocate', ['user_id' => $reseller->id, 'gb_amount' => 60])->assertOk();
        $this->assertEquals(40, $admin->fresh()->gb_balance);
        $this->assertEquals(60, $reseller->fresh()->gb_balance);

        // Over-allocate the remaining 40.
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/gb/allocate', ['user_id' => $reseller->id, 'gb_amount' => 999])->assertStatus(422);
        $this->assertEquals(40, $admin->fresh()->gb_balance);
    }

    public function test_reseller_cannot_load_seller_wallet(): void
    {
        $reseller = $this->makeUser('reseller', ['wallet_balance' => 1000]);
        $seller = $this->makeUser('seller', ['parent_id' => $reseller->id, 'wallet_balance' => 100]);

        $this->actingAs($reseller, 'sanctum')
            ->postJson('/api/wallet/load', ['user_id' => $seller->id, 'amount' => 350])
            ->assertStatus(403);

        $this->assertEquals(1000, $reseller->fresh()->wallet_balance);
        $this->assertEquals(100, $seller->fresh()->wallet_balance);
    }
}
