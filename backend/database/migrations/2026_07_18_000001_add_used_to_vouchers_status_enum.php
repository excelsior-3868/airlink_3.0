<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Add 'used' to the vouchers.status enum.
 *
 * The redeem flow (VoucherController@redeem) sets status = 'used' when a GB
 * voucher is consumed, but the original enum omitted that value — so those
 * writes were rejected/coerced by MariaDB. This aligns the schema with the
 * actual lifecycle: new → sold → active → used / expired / disabled.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement(
            "ALTER TABLE vouchers MODIFY COLUMN status "
            . "ENUM('new', 'sold', 'active', 'used', 'expired', 'disabled') "
            . "NOT NULL DEFAULT 'new'"
        );
    }

    public function down(): void
    {
        // Fold any 'used' rows into 'expired' before shrinking the enum, otherwise
        // the ALTER would fail (or blank out) rows holding the removed value.
        DB::statement("UPDATE vouchers SET status = 'expired' WHERE status = 'used'");
        DB::statement(
            "ALTER TABLE vouchers MODIFY COLUMN status "
            . "ENUM('new', 'sold', 'active', 'expired', 'disabled') "
            . "NOT NULL DEFAULT 'new'"
        );
    }
};
