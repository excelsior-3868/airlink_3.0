<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class RadiusStatusAndLogsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_retrieve_radius_auth_logs_and_brute_force_metrics(): void
    {
        // Seed mock logs
        DB::table('radpostauth')->insert([
            ['username' => 'user_1', 'pass' => 'pass123', 'reply' => 'Access-Accept', 'authdate' => now()],
            ['username' => 'user_2', 'pass' => 'pass456', 'reply' => 'Access-Reject', 'authdate' => now()->subMinutes(1)],
            ['username' => 'brute_user', 'pass' => 'try1', 'reply' => 'Access-Reject', 'authdate' => now()],
            ['username' => 'brute_user', 'pass' => 'try2', 'reply' => 'Access-Reject', 'authdate' => now()],
            ['username' => 'brute_user', 'pass' => 'try3', 'reply' => 'Access-Reject', 'authdate' => now()],
            ['username' => 'brute_user', 'pass' => 'try4', 'reply' => 'Access-Reject', 'authdate' => now()],
            ['username' => 'brute_user', 'pass' => 'try5', 'reply' => 'Access-Reject', 'authdate' => now()],
            ['username' => 'brute_user', 'pass' => 'try6', 'reply' => 'Access-Reject', 'authdate' => now()],
        ]);

        $admin = $this->makeUser('admin');

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/radius/auth-logs')
            ->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'failed_24h',
                    'brute_force',
                    'logs',
                    'meta'
                ]
            ]);

        $data = $response->json('data');
        $this->assertEquals(7, $data['failed_24h']);
        $this->assertCount(1, $data['brute_force']);
        $this->assertEquals('brute_user', $data['brute_force'][0]['username']);
        $this->assertEquals(6, $data['brute_force'][0]['failures']);
        $this->assertCount(8, $data['logs']);
    }

    public function test_reseller_cannot_retrieve_radius_auth_logs(): void
    {
        $reseller = $this->makeUser('reseller');

        $this->actingAs($reseller, 'sanctum')
            ->getJson('/api/radius/auth-logs')
            ->assertStatus(403);
    }

    public function test_seller_cannot_retrieve_radius_auth_logs(): void
    {
        $seller = $this->makeUser('seller');

        $this->actingAs($seller, 'sanctum')
            ->getJson('/api/radius/auth-logs')
            ->assertStatus(403);
    }

    public function test_admin_can_retrieve_radius_clients_config(): void
    {
        $admin = $this->makeUser('admin');

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/radius/clients-config')
            ->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'raw',
                    'parsed'
                ]
            ]);

        $parsed = $response->json('data.parsed');
        $this->assertNotEmpty($parsed);
        $this->assertEquals('localhost', $parsed[0]['name']);
        $this->assertEquals('127.0.0.1', $parsed[0]['ipaddr']);
    }

    public function test_non_admin_cannot_retrieve_clients_config(): void
    {
        $reseller = $this->makeUser('reseller');

        $this->actingAs($reseller, 'sanctum')
            ->getJson('/api/radius/clients-config')
            ->assertStatus(403);
    }
}
