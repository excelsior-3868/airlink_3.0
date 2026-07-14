<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('voucher_card_templates', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('width')->default(360);
            $table->unsignedInteger('height')->default(225);
            // Uploaded background stored inline as a data URI so the design is
            // self-contained (no storage symlink / cross-origin concerns).
            $table->mediumText('background_data')->nullable();
            // Ordered text/icon elements with position (%) and styling.
            $table->json('elements')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voucher_card_templates');
    }
};
