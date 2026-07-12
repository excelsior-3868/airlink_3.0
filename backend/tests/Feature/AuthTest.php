<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_succeeds_with_valid_credentials(): void
    {
        $this->makeUser('admin', ['username' => 'boss']);

        $res = $this->postJson('/api/login', ['username' => 'boss', 'password' => 'password']);

        $res->assertOk()->assertJsonStructure(['data' => ['token', 'user' => ['id', 'role']]]);
    }

    public function test_login_fails_with_wrong_password(): void
    {
        $this->makeUser('admin', ['username' => 'boss']);

        $this->postJson('/api/login', ['username' => 'boss', 'password' => 'nope'])->assertStatus(401);
    }

    public function test_disabled_user_cannot_login(): void
    {
        $this->makeUser('seller', ['username' => 'off', 'status' => 'disabled']);

        $this->postJson('/api/login', ['username' => 'off', 'password' => 'password'])->assertStatus(403);
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/me')->assertStatus(401);
    }

    public function test_me_returns_current_user(): void
    {
        $user = $this->makeUser('reseller');

        $this->actingAs($user, 'sanctum')->getJson('/api/me')
            ->assertOk()->assertJsonPath('data.username', $user->username);
    }

    public function test_change_password_succeeds_with_valid_current_password(): void
    {
        $user = $this->makeUser('reseller');

        $res = $this->actingAs($user, 'sanctum')->postJson('/api/change-password', [
            'current_password' => 'password',
            'new_password' => 'new_pass_123',
            'new_password_confirmation' => 'new_pass_123',
        ]);

        $res->assertOk();
        $this->assertTrue(Hash::check('new_pass_123', $user->fresh()->password));
    }

    public function test_change_password_fails_with_invalid_current_password(): void
    {
        $user = $this->makeUser('reseller');

        $res = $this->actingAs($user, 'sanctum')->postJson('/api/change-password', [
            'current_password' => 'wrong_pass',
            'new_password' => 'new_pass_123',
            'new_password_confirmation' => 'new_pass_123',
        ]);

        $res->assertStatus(422);
    }
}
