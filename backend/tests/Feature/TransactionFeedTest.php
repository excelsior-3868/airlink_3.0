<?php

namespace Tests\Feature;

use App\Models\SystemPermission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TransactionFeedTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Build a small hierarchy with wallet + GB movements so the unified feed
     * has rows of every source to assert against.
     */
    private function seedTree(): array
    {
        // Allow resellers to allocate GB so the reseller→seller leg can run.
        SystemPermission::create([
            'feature' => 'allocate_gb', 'display_name' => 'Allocate GB', 'category' => 'billing',
            'admin' => true, 'reseller' => true, 'seller' => false,
        ]);

        $admin = $this->makeUser('admin', ['wallet_balance' => 100000, 'gb_balance' => 100000]);
        $reseller = $this->makeUser('reseller', ['parent_id' => $admin->id, 'gb_rate' => 100]);
        $seller = $this->makeUser('seller', ['parent_id' => $reseller->id, 'gb_rate' => 150]);

        // admin funds + allocates to reseller (wallet + gb + invoice + partial payment)
        $this->actingAs($admin, 'sanctum')->postJson('/api/wallet/load', ['user_id' => $reseller->id, 'amount' => 5000])->assertOk();
        $this->actingAs($admin, 'sanctum')->postJson('/api/gb/allocate', ['user_id' => $reseller->id, 'gb_amount' => 50, 'paid_amount' => 2000])->assertOk();

        // reseller allocates GB down to seller (invoice + gb rows under reseller subtree)
        $this->actingAs($reseller, 'sanctum')->postJson('/api/gb/allocate', ['user_id' => $seller->id, 'gb_amount' => 10])->assertOk();

        return compact('admin', 'reseller', 'seller');
    }

    public function test_admin_sees_transactions_from_the_whole_tree(): void
    {
        ['admin' => $admin] = $this->seedTree();

        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/transactions?per_page=100')->assertOk();
        $sources = collect($res->json('data.data'))->pluck('source')->unique()->sort()->values()->all();

        // Every ledger type should be present for the admin.
        $this->assertEqualsCanonicalizing(['gb', 'invoice', 'payment', 'wallet'], $sources);
    }

    public function test_seller_only_sees_own_transactions(): void
    {
        ['seller' => $seller] = $this->seedTree();

        $rows = $this->actingAs($seller, 'sanctum')->getJson('/api/transactions?per_page=100')->assertOk()->json('data.data');

        $this->assertNotEmpty($rows);
        foreach ($rows as $row) {
            // Seller must never see a row whose counterparties are both outside its own account.
            $touchesSeller = in_array($seller->username, [$row['account'], $row['from'], $row['to']], true);
            $this->assertTrue($touchesSeller, 'Seller saw a transaction it should not: ' . json_encode($row));
        }
    }

    public function test_source_filter_limits_results(): void
    {
        ['admin' => $admin] = $this->seedTree();

        $rows = $this->actingAs($admin, 'sanctum')->getJson('/api/transactions?source=payment&per_page=100')->assertOk()->json('data.data');

        $this->assertNotEmpty($rows);
        foreach ($rows as $row) {
            $this->assertEquals('payment', $row['source']);
        }
    }

    public function test_user_id_drilldown_rejects_out_of_scope_user(): void
    {
        ['seller' => $seller, 'admin' => $admin] = $this->seedTree();

        // Seller cannot request the admin's transaction history.
        $this->actingAs($seller, 'sanctum')
            ->getJson("/api/transactions?user_id={$admin->id}")
            ->assertStatus(403);
    }
}
