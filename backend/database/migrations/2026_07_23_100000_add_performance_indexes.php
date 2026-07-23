<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // internet_plans: index columns used in WHERE / ORDER BY
        Schema::table('internet_plans', function (Blueprint $table) {
            $table->index('type',       'ip_type_idx');
            $table->index('status',     'ip_status_idx');
            $table->index('created_by', 'ip_created_by_idx');
            $table->index('name',       'ip_name_idx');
        });

        // bandwidths: index the name column used in ORDER BY
        Schema::table('bandwidths', function (Blueprint $table) {
            $table->index('name', 'bw_name_idx');
        });
    }

    public function down(): void
    {
        Schema::table('internet_plans', function (Blueprint $table) {
            $table->dropIndex('ip_type_idx');
            $table->dropIndex('ip_status_idx');
            $table->dropIndex('ip_created_by_idx');
            $table->dropIndex('ip_name_idx');
        });

        Schema::table('bandwidths', function (Blueprint $table) {
            $table->dropIndex('bw_name_idx');
        });
    }
};
