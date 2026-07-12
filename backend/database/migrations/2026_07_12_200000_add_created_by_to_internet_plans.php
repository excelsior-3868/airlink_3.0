<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('internet_plans', function (Blueprint $table) {
            $table->foreignId('created_by')->nullable()->after('api_nas')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('internet_plans', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropColumn('created_by');
        });
    }
};
