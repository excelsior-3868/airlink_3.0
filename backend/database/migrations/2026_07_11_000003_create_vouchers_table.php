<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vouchers', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('username')->index();  // RADIUS username (maps to radcheck)
            $table->string('password');

            $table->foreignId('plan_id')->constrained('internet_plans')->restrictOnDelete();
            $table->foreignId('batch_id')->nullable()->constrained('batches')->nullOnDelete();

            // Ownership chain (voucher belongs to whoever generated it, plus its tree).
            $table->foreignId('owner_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('reseller_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('seller_id')->nullable()->constrained('users')->nullOnDelete();

            // Snapshot of cost/quota at generation time.
            $table->decimal('data_gb', 12, 3)->nullable();
            $table->unsignedInteger('validity_days')->default(0);
            $table->decimal('price', 12, 2)->default(0);

            $table->enum('status', ['new', 'sold', 'active', 'expired', 'disabled'])->default('new')->index();
            $table->timestamp('sold_at')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->string('customer_username')->nullable();

            $table->unsignedBigInteger('legacy_id')->nullable()->unique();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vouchers');
    }
};
