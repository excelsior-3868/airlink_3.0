<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('username')->unique();
            $table->string('email')->nullable()->unique();
            $table->string('phone', 30)->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');

            // v3.0 distribution hierarchy: admin → reseller → seller.
            $table->enum('role', ['admin', 'reseller', 'seller']);
            $table->foreignId('parent_id')->nullable()->constrained('users')->nullOnDelete();

            // Dual balances — both deduct on voucher generation.
            $table->decimal('wallet_balance', 14, 2)->default(0);   // Rs
            $table->decimal('gb_balance', 14, 3)->default(0);       // GB

            $table->enum('status', ['active', 'disabled'])->default('active');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            // Legacy migration bookkeeping (idempotent ETL + forced resets).
            $table->boolean('must_reset_password')->default(false);
            $table->unsignedBigInteger('legacy_id')->nullable()->unique();
            $table->string('legacy_username')->nullable();

            $table->rememberToken();
            $table->timestamps();

            $table->index('role');
            $table->index('parent_id');
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
