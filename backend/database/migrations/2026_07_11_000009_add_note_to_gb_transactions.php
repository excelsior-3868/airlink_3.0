<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gb_transactions', function (Blueprint $table) {
            $table->string('note')->nullable()->after('reference');
        });
    }

    public function down(): void
    {
        Schema::table('gb_transactions', function (Blueprint $table) {
            $table->dropColumn('note');
        });
    }
};
