<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    /**
     * Hard guard: refuse to run tests against any database that is not clearly
     * a test DB. RefreshDatabase drops all tables, so a misconfigured
     * connection could wipe live data — abort loudly before that happens.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $db = DB::connection()->getDatabaseName();
        if (! str_contains((string) $db, 'test')) {
            throw new RuntimeException("Refusing to run tests against non-test database '{$db}'. Check phpunit.xml / DB_CONNECTION.");
        }
    }

    protected function makeUser(string $role, array $attrs = []): User
    {
        static $n = 0;
        $n++;

        return User::create(array_merge([
            'name' => ucfirst($role)." $n",
            'username' => "{$role}{$n}",
            'password' => Hash::make('password'),
            'role' => $role,
            'status' => 'active',
            'wallet_balance' => 0,
            'gb_balance' => 0,
        ], $attrs));
    }
}
