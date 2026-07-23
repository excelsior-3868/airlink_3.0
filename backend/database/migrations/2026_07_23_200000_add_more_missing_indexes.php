<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vouchers', function (Blueprint $table) {
            $table->index('reseller_id', 'vch_reseller_idx');
            $table->index('seller_id', 'vch_seller_idx');
            $table->index('plan_id', 'vch_plan_idx');
            $table->index('created_at', 'vch_created_idx');
            $table->index(['reseller_id', 'status'], 'vch_reseller_status_idx');
        });

    }

    public function down(): void
    {
        Schema::table('vouchers', function (Blueprint $table) {
            $table->dropIndex('vch_reseller_idx');
            $table->dropIndex('vch_seller_idx');
            $table->dropIndex('vch_plan_idx');
            $table->dropIndex('vch_created_idx');
            $table->dropIndex('vch_reseller_status_idx');
        });

    }
};
