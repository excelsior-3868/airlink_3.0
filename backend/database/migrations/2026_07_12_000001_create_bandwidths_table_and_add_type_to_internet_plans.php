<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bandwidths', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->unsignedInteger('rate_down');
            $table->enum('rate_down_unit', ['Kbps', 'Mbps']);
            $table->unsignedInteger('rate_up');
            $table->enum('rate_up_unit', ['Kbps', 'Mbps']);
            $table->timestamps();
        });

        Schema::table('internet_plans', function (Blueprint $table) {
            $table->enum('type', ['hotspot', 'pppoe'])->default('hotspot')->after('name');
            $table->foreignId('bandwidth_id')->nullable()->after('bandwidth')->constrained('bandwidths')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('internet_plans', function (Blueprint $table) {
            $table->dropForeign(['bandwidth_id']);
            $table->dropColumn(['bandwidth_id', 'type']);
        });

        Schema::dropIfExists('bandwidths');
    }
};
