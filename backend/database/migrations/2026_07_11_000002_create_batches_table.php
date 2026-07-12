<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('batches', function (Blueprint $table) {
            $table->id();
            $table->string('batch_code')->unique();            // e.g. BAT260711
            $table->foreignId('plan_id')->constrained('internet_plans')->cascadeOnDelete();
            $table->unsignedInteger('quantity')->default(0);
            $table->foreignId('generated_by')->nullable()->constrained('users')->nullOnDelete();

            $table->string('legacy_batch')->nullable()->index(); // legacy tbl_voucher.batch value
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('batches');
    }
};
