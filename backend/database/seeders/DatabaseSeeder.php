<?php

namespace Database\Seeders;

use App\Models\GbTransaction;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed a default admin, reseller, and seller with initial balances
     * aligning with the Airlink 3.0 specification diagrams.
     */
    public function run(): void
    {
        $openingGb = (float) env('ADMIN_OPENING_GB', 100000);
        $openingWallet = (float) env('ADMIN_OPENING_WALLET', 10000000);

        // 1. Seed Admin
        $admin = User::firstOrCreate(
            ['username' => 'admin'],
            [
                'name' => 'Administrator',
                'email' => 'admin@airlink.local',
                'password' => Hash::make('admin123'),
                'role' => 'admin',
                'status' => 'active',
                'wallet_balance' => $openingWallet,
                'gb_balance' => $openingGb,
            ]
        );

        if ($admin->wasRecentlyCreated && $openingGb > 0) {
            GbTransaction::create([
                'user_id' => $admin->id,
                'type' => 'opening',
                'gb_amount' => $openingGb,
                'balance_after' => $openingGb,
                'reference' => 'seed:opening-pool',
            ]);
        }

        // 2. Seed Reseller Alpha (Rs 50,000 / 1000 GB from PDF Flow)
        $reseller = User::firstOrCreate(
            ['username' => 'reseller_a'],
            [
                'name' => 'Reseller Alpha',
                'email' => 'reseller_a@airlink.local',
                'password' => Hash::make('reseller123'),
                'role' => 'reseller',
                'parent_id' => $admin->id,
                'created_by' => $admin->id,
                'status' => 'active',
                'wallet_balance' => 50000.00,
                'gb_balance' => 1000.0,
            ]
        );

        // 3. Seed Seller Alpha (Rs 10,000 / 200 GB from PDF Flow)
        $seller = User::firstOrCreate(
            ['username' => 'seller_a'],
            [
                'name' => 'Seller Alpha',
                'email' => 'seller_a@airlink.local',
                'password' => Hash::make('seller123'),
                'role' => 'seller',
                'parent_id' => $reseller->id,
                'created_by' => $reseller->id,
                'status' => 'active',
                'wallet_balance' => 10000.00,
                'gb_balance' => 200.0,
            ]
        );

        // 4. Seed default System Permissions matrix
        $perms = [
            ['feature' => 'create_plan', 'display_name' => 'Create Plan', 'category' => 'System', 'description' => 'Define new internet plans and pricing', 'admin' => 1, 'reseller' => 0, 'seller' => 0],
            ['feature' => 'create_reseller', 'display_name' => 'Create Reseller', 'category' => 'User Management', 'description' => 'Register top-level resellers parented to admin', 'admin' => 1, 'reseller' => 0, 'seller' => 0],
            ['feature' => 'create_seller', 'display_name' => 'Create Seller', 'category' => 'User Management', 'description' => 'Register retail seller accounts under a reseller', 'admin' => 1, 'reseller' => 1, 'seller' => 0],
            ['feature' => 'wallet_load', 'display_name' => 'Wallet Load', 'category' => 'Wallet', 'description' => 'Load monetary balance to downline user accounts', 'admin' => 1, 'reseller' => 1, 'seller' => 0],
            ['feature' => 'allocate_gb', 'display_name' => 'Allocate GB', 'category' => 'GB Allocation', 'description' => 'Allocate internet data quota to downline user accounts', 'admin' => 1, 'reseller' => 1, 'seller' => 0],
            ['feature' => 'generate_voucher', 'display_name' => 'Generate Voucher', 'category' => 'Voucher', 'description' => 'Generate printable hotspot access vouchers', 'admin' => 1, 'reseller' => 1, 'seller' => 1],
            ['feature' => 'delete_voucher', 'display_name' => 'Delete Voucher', 'category' => 'Voucher', 'description' => 'Completely delete and void generated vouchers', 'admin' => 1, 'reseller' => 0, 'seller' => 0],
            ['feature' => 'reports', 'display_name' => 'Reports', 'category' => 'Reports', 'description' => 'View usage, sales summaries and packages statistics', 'admin' => 1, 'reseller' => 1, 'seller' => 1],
            ['feature' => 'dashboard', 'display_name' => 'Dashboard', 'category' => 'Dashboard', 'description' => 'View statistics, balances and charts', 'admin' => 1, 'reseller' => 1, 'seller' => 1],
        ];

        foreach ($perms as $p) {
            \App\Models\SystemPermission::updateOrCreate(
                ['feature' => $p['feature']],
                $p
            );
        }
    }
}
