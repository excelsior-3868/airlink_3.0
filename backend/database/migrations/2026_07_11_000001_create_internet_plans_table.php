<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('internet_plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('plan_type', ['data', 'time', 'unlimited']);
            $table->string('bandwidth')->nullable();          // e.g. "10M/10M" (down/up)
            $table->decimal('data_gb', 12, 3)->nullable();     // for data plans
            $table->unsignedInteger('time_limit')->nullable(); // minutes, for time plans
            $table->unsignedInteger('validity_days')->default(0);
            $table->decimal('base_price', 12, 2)->default(0);   // admin cost
            $table->decimal('selling_price', 12, 2)->default(0);
            $table->string('api_nas')->nullable();              // target NAS/router
            $table->enum('status', ['active', 'disabled'])->default('active');

            $table->unsignedBigInteger('legacy_id')->nullable()->unique();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('internet_plans');
    }
};
