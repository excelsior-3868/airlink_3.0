<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_permissions', function (Blueprint $table) {
            $table->id();
            $table->string('feature')->unique();
            $table->string('display_name');
            $table->string('category');
            $table->string('description')->nullable();
            $table->boolean('admin')->default(true);
            $table->boolean('reseller')->default(false);
            $table->boolean('seller')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_permissions');
    }
};
