<?php

namespace App\Console\Commands;

use App\Models\Voucher;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Drives voucher lifecycle from RADIUS accounting + expiry dates.
 * Runs on a schedule (see routes/console.php).
 *   new/sold + open radacct session → active
 *   any non-terminal + past expires_at → expired
 */
class SyncVoucherStatus extends Command
{
    protected $signature = 'vouchers:sync-status';

    protected $description = 'Update voucher statuses from radacct sessions and expiry dates';

    public function handle(): int
    {
        // 1. Mark as active any new/sold voucher with an open accounting session.
        $activeUsernames = DB::table('radacct')->whereNull('acctstoptime')->distinct()->pluck('username');
        $activated = 0;
        foreach ($activeUsernames->chunk(1000) as $chunk) {
            $activated += Voucher::whereIn('username', $chunk)
                ->whereIn('status', ['new', 'sold'])
                ->update(['status' => 'active', 'activated_at' => now()]);
        }

        // 2. Expire anything past its expiry that isn't already terminal.
        $expired = Voucher::whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->whereIn('status', ['new', 'sold', 'active'])
            ->update(['status' => 'expired']);

        $this->info("Sync complete: {$activated} activated, {$expired} expired.");

        return self::SUCCESS;
    }
}
