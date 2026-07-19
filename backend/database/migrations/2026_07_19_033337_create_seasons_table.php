<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('seasons', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->unsignedTinyInteger('start_month');
            $table->unsignedTinyInteger('start_day');
            $table->unsignedTinyInteger('end_month');
            $table->unsignedTinyInteger('end_day');
            $table->timestamps();
        });

        // Seed default seasons
        DB::table('seasons')->insert([
            [
                'name' => 'Spring',
                'start_month' => 3,
                'start_day' => 1,
                'end_month' => 5,
                'end_day' => 31,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Summer',
                'start_month' => 6,
                'start_day' => 1,
                'end_month' => 8,
                'end_day' => 31,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Autumn',
                'start_month' => 9,
                'start_day' => 1,
                'end_month' => 11,
                'end_day' => 30,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Winter',
                'start_month' => 12,
                'start_day' => 1,
                'end_month' => 2,
                'end_day' => 28,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('seasons');
    }
};
