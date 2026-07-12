<?php

namespace App\Console\Commands;

use App\Models\Batch;
use App\Models\GbTransaction;
use App\Models\InternetPlan;
use App\Models\User;
use App\Models\Voucher;
use App\Models\WalletTransaction;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Throwable;

/**
 * ETL: migrate the legacy v2.0 dump (airlink_legacy) into the clean v3.0
 * schema (airlink). Idempotent (keyed on legacy_id), --dry-run capable, and
 * emits a review report (storage/app/legacy-import-report.json) so the
 * inferred hierarchy/roles and forced password resets can be corrected.
 *
 * Legacy shape learned from the data:
 *  - Voucher code == RADIUS username == password. tbl_customers (superset of
 *    tbl_voucher) is the authoritative voucher/credential source and matches
 *    radcheck 1:1 (Cleartext-Password, User-Profile, Expire-After, ...).
 *  - generated_for on a customer names the reseller/seller it was allocated to.
 *  - tbl_users are staff (Admin/Sales/POS); wallet holds their money balance.
 */
class LegacyImport extends Command
{
    protected $signature = 'legacy:import {--dry-run : Compute and report without writing} {--fresh : Wipe previously imported rows first}';

    protected $description = 'Migrate legacy v2.0 data (airlink_legacy) into the v3.0 schema';

    private const TEMP_PASSWORD = 'ChangeMe123!';

    private array $report = [];

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $this->info($dry ? 'DRY RUN — no changes will be written.' : 'Running legacy import...');

        try {
            DB::transaction(function () use ($dry) {
                $planMap = $this->importPlans();
                $userMap = $this->importStaff();
                $this->importWallets($userMap);
                $this->reconstructHierarchy($userMap);
                $this->importVouchers($planMap, $userMap);

                if ($dry) {
                    // Roll the whole thing back — we only wanted the numbers.
                    throw new DryRunComplete();
                }
            });
        } catch (DryRunComplete) {
            // expected on --dry-run
        } catch (Throwable $e) {
            $this->error('Import failed and was rolled back: '.$e->getMessage());
            throw $e;
        }

        // radcheck/radreply copy is a bulk cross-schema INSERT..SELECT — done
        // after the transaction commits (skipped on dry-run, counted instead).
        if ($dry) {
            $this->report['radius'] = $this->radiusCandidateCounts();
        } else {
            $this->report['radius'] = $this->copyRadius();
        }

        $this->writeReport($dry);
        $this->renderSummary();

        return self::SUCCESS;
    }

    // ---- Plans -------------------------------------------------------------

    /** @return array<int,int> legacy plan id => new plan id */
    private function importPlans(): array
    {
        $bwRows = DB::connection('legacy')->table('tbl_bandwidth')->get();
        $bwMap = [];
        $bwKeyed = $bwRows->keyBy('id');
        
        foreach ($bwRows as $b) {
            $newBw = \App\Models\Bandwidth::updateOrCreate(
                ['name' => $b->name_bw],
                [
                    'rate_down' => (int) $b->rate_down,
                    'rate_down_unit' => $b->rate_down_unit,
                    'rate_up' => (int) $b->rate_up,
                    'rate_up_unit' => $b->rate_up_unit,
                ]
            );
            $bwMap[$b->id] = $newBw->id;
        }

        $map = [];
        $rows = DB::connection('legacy')->table('tbl_plans')->get();

        foreach ($rows as $p) {
            $dataGb = (float) $p->data_usage_gb;
            if ($dataGb <= 0 && $p->data_limit > 0) {
                $dataGb = strtoupper((string) $p->data_unit) === 'MB'
                    ? round($p->data_limit / 1024, 3)
                    : (float) $p->data_limit;
            }

            $timeMin = null;
            if ((int) $p->time_limit > 0) {
                $timeMin = strtoupper((string) $p->time_unit) === 'HRS'
                    ? (int) $p->time_limit * 60
                    : (int) $p->time_limit;
            }

            $planType = $dataGb > 0 ? 'data' : ($timeMin ? 'time' : 'unlimited');

            $plan = InternetPlan::updateOrCreate(
                ['legacy_id' => $p->id],
                [
                    'name' => $p->name_plan,
                    'type' => strtolower($p->type), // hotspot or pppoe
                    'plan_type' => $planType,
                    'bandwidth_id' => $bwMap[$p->id_bw] ?? null,
                    'bandwidth' => $this->bandwidthLabel($bwKeyed->get($p->id_bw)),
                    'data_gb' => $dataGb > 0 ? $dataGb : null,
                    'time_limit' => $timeMin,
                    'validity_days' => $this->toDays((int) $p->validity, (string) $p->validity_unit),
                    'base_price' => (float) $p->price,
                    'selling_price' => (float) $p->price,
                    'api_nas' => $p->routers !== '0' ? $p->routers : null,
                    'status' => 'active',
                ]
            );
            $map[$p->id] = $plan->id;
        }

        $this->report['plans'] = ['imported' => count($map)];

        return $map;
    }

    private function bandwidthLabel(?object $bw): ?string
    {
        if (! $bw) {
            return null;
        }
        $short = fn ($u) => strtoupper($u) === 'MBPS' ? 'M' : (strtoupper($u) === 'KBPS' ? 'K' : $u);

        return "{$bw->rate_down}{$short($bw->rate_down_unit)}/{$bw->rate_up}{$short($bw->rate_up_unit)}";
    }

    private function toDays(int $value, string $unit): int
    {
        return match (strtolower($unit)) {
            'h' => (int) max(1, ceil($value / 24)),
            'm' => $value * 30,
            default => max($value, 0), // 'd' or blank
        };
    }

    // ---- Staff / users -----------------------------------------------------

    /** @return array<string,\App\Models\User> legacy username => user */
    private function importStaff(): array
    {
        $roleReport = [];
        $map = [];
        $rows = DB::connection('legacy')->table('tbl_users')->get();

        foreach ($rows as $u) {
            $role = match (strtolower($u->user_type ?? '')) {
                'admin' => 'admin',
                'sales' => 'reseller',
                default => 'seller', // Regular / POS
            };

            // Reuse the seeded admin if usernames collide; else create/update
            // keyed on legacy_id so re-runs are idempotent.
            $existing = User::where('legacy_id', $u->id)
                ->orWhere('username', $u->username)
                ->first();

            $attrs = [
                'name' => $u->fullname ?: $u->username,
                'username' => $u->username,
                'role' => $role,
                'status' => strtolower($u->status) === 'inactive' ? 'disabled' : 'active',
                'legacy_id' => $u->id,
                'legacy_username' => $u->username,
                'must_reset_password' => true,
            ];

            if ($existing) {
                // Never downgrade/overwrite the seeded admin's known password.
                $existing->fill($attrs);
                if (! $existing->password) {
                    $existing->password = Hash::make(self::TEMP_PASSWORD);
                }
                $existing->save();
                $user = $existing;
            } else {
                $user = User::create($attrs + ['password' => Hash::make(self::TEMP_PASSWORD)]);
            }

            $map[$u->username] = $user;
            $roleReport[] = [
                'legacy_id' => $u->id,
                'username' => $u->username,
                'legacy_type' => $u->user_type,
                'assigned_role' => $role,
                'password_reset_required' => true,
            ];
        }

        $this->report['users'] = $roleReport;

        return $map;
    }

    // ---- Wallets -----------------------------------------------------------

    private function importWallets(array $userMap): void
    {
        $walletReport = [];
        $rows = DB::connection('legacy')->table('wallet')->get();

        foreach ($rows as $w) {
            $user = $userMap[$w->username] ?? null;
            if (! $user) {
                $walletReport[] = ['username' => $w->username, 'status' => 'no matching staff user — skipped'];

                continue;
            }

            $balance = (float) ($w->available_balance ?? $w->credit_balance ?? 0);
            $user->update(['wallet_balance' => $balance]);

            WalletTransaction::updateOrCreate(
                ['user_id' => $user->id, 'type' => 'opening', 'reference' => 'legacy:wallet'],
                ['amount' => $balance, 'balance_after' => $balance, 'note' => 'Imported opening balance from v2.0 wallet']
            );

            $walletReport[] = ['username' => $w->username, 'balance_rs' => $balance];
        }

        $this->report['wallets'] = $walletReport;
        $this->report['wallet_unit_note'] = 'available_balance imported verbatim as Rs — confirm the v2.0 unit (Rs vs paisa).';
    }

    // ---- Hierarchy ---------------------------------------------------------

    private function reconstructHierarchy(array $userMap): void
    {
        $admins = array_filter($userMap, fn ($u) => $u->role === 'admin');
        $resellers = array_filter($userMap, fn ($u) => $u->role === 'reseller');

        $primaryAdmin = $userMap['admin'] ?? (reset($admins) ?: null);
        $primaryReseller = reset($resellers) ?: null;

        $links = [];
        foreach ($userMap as $u) {
            if ($u->role === 'reseller' && $primaryAdmin) {
                $u->update(['parent_id' => $primaryAdmin->id, 'created_by' => $primaryAdmin->id]);
                $links[] = ['user' => $u->username, 'role' => 'reseller', 'parent' => $primaryAdmin->username, 'confidence' => 'high'];
            } elseif ($u->role === 'seller') {
                // Legacy allocated to sellers directly from admin; best-guess
                // parent is the reseller. Flag LOW for review.
                $parent = $primaryReseller ?: $primaryAdmin;
                if ($parent) {
                    $u->update(['parent_id' => $parent->id, 'created_by' => $primaryAdmin?->id]);
                    $links[] = ['user' => $u->username, 'role' => 'seller', 'parent' => $parent->username, 'confidence' => 'low — verify in UI'];
                }
            }
        }

        $this->report['hierarchy'] = $links;
    }

    // ---- Vouchers / customers ----------------------------------------------

    private function importVouchers(array $planMap, array $userMap): void
    {
        $admin = $userMap['admin'] ?? User::where('role', 'admin')->first();
        $plansByName = InternetPlan::pluck('id', 'name');
        $plansById = InternetPlan::get()->keyBy('id');

        // Batches first (distinct, non-empty batch codes).
        $batchMap = [];
        $batchCodes = DB::connection('legacy')->table('tbl_customers')
            ->select('batch')->whereNotNull('batch')->where('batch', '!=', '')
            ->distinct()->pluck('batch');
        foreach ($batchCodes as $code) {
            $batch = Batch::updateOrCreate(
                ['legacy_batch' => $code],
                ['batch_code' => 'LEG-'.$code, 'plan_id' => $plansByName->first() ?: null, 'generated_by' => $admin?->id, 'quantity' => 0]
            );
            $batchMap[$code] = $batch->id;
        }

        $imported = 0;
        $skipped = 0;
        $now = now();

        DB::connection('legacy')->table('tbl_customers')->orderBy('id')->chunk(1000, function ($chunk) use (
            $planMap, $userMap, $admin, $plansByName, $plansById, $batchMap, &$imported, &$skipped, $now
        ) {
            $insert = [];
            foreach ($chunk as $c) {
                $planId = $plansByName[$c->profile] ?? null;
                if (! $planId) {
                    $skipped++;

                    continue;
                }
                $plan = $plansById[$planId];

                // Ownership from generated_for.
                $ownerId = $admin?->id;
                $resellerId = null;
                $sellerId = null;
                $gf = $c->generated_for ?? null;
                if ($gf && isset($userMap[$gf])) {
                    $target = $userMap[$gf];
                    if ($target->role === 'seller') {
                        $sellerId = $target->id;
                        $resellerId = $target->parent_id;
                        $ownerId = $target->id;
                    } elseif ($target->role === 'reseller') {
                        $resellerId = $target->id;
                        $ownerId = $target->id;
                    }
                }

                $createdAt = $c->created_at ?: $now;
                $insert[] = [
                    'code' => $c->username,
                    'username' => $c->username,
                    'password' => $c->password,
                    'plan_id' => $planId,
                    'batch_id' => $batchMap[$c->batch] ?? null,
                    'owner_id' => $ownerId,
                    'reseller_id' => $resellerId,
                    'seller_id' => $sellerId,
                    'data_gb' => $plan->data_gb,
                    'validity_days' => $plan->validity_days,
                    'price' => $plan->selling_price,
                    'status' => strtolower($c->status) === 'deactivate' ? 'disabled' : 'new',
                    'customer_username' => $c->fullname ?: null,
                    'legacy_id' => $c->id,
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ];
                $imported++;
            }
            if ($insert) {
                Voucher::upsert(
                    $insert,
                    ['legacy_id'],
                    ['status', 'plan_id', 'owner_id', 'reseller_id', 'seller_id', 'batch_id', 'data_gb', 'price']
                );
            }
        });

        $this->report['vouchers'] = ['imported' => $imported, 'skipped_no_plan' => $skipped, 'batches' => count($batchMap)];
    }

    // ---- FreeRADIUS credential copy ----------------------------------------

    private function copyRadius(): array
    {
        // Standard FreeRADIUS semantics: radcheck holds ONLY genuine check
        // items (Cleartext-Password). The legacy dump also parked reply-type
        // attributes (User-Profile, Total-Volume-Limit, Expire-After,
        // Daily-Quota-Limit) in radcheck, where they become must-match check
        // items and cause Access-Reject. We route those to radreply instead.
        // COLLATE reconciles airlink (utf8mb4_unicode_ci) vs legacy (general_ci).

        // Attributes safe to send back to a NAS. Legacy counter/plan artifacts
        // (Total-Volume-Limit, Expire-After, Daily-Quota-Limit, User-Profile)
        // are NOT real reply attributes — stock FreeRADIUS can't parse them and
        // rejects the request. Their semantics already live in internet_plans /
        // vouchers; the v3.0 RadiusService regenerates proper NAS attributes.
        $safeReplyWhere = "(l.attribute LIKE 'Mikrotik-%' OR l.attribute IN (
            'Session-Timeout','Idle-Timeout','Port-Limit','Framed-Pool',
            'Acct-Interim-Interval','Framed-IP-Address','Framed-IP-Netmask'
        ))";

        // Idempotent cleanup of any rows a prior run placed incorrectly.
        DB::statement("DELETE FROM airlink.radcheck WHERE attribute <> 'Cleartext-Password'");
        DB::statement("DELETE FROM airlink.radreply
            WHERE attribute NOT LIKE 'Mikrotik-%'
              AND attribute NOT IN ('Session-Timeout','Idle-Timeout','Port-Limit',
                    'Framed-Pool','Acct-Interim-Interval','Framed-IP-Address','Framed-IP-Netmask')");

        // 1. radcheck ← Cleartext-Password only.
        DB::statement("
            INSERT INTO airlink.radcheck (username, attribute, op, value)
            SELECT l.username, l.attribute, l.op, l.value
            FROM airlink_legacy.radcheck l
            WHERE l.attribute = 'Cleartext-Password'
              AND l.username IN (SELECT username FROM airlink_legacy.tbl_customers)
              AND NOT EXISTS (
                SELECT 1 FROM airlink.radcheck a
                WHERE a.username = l.username COLLATE utf8mb4_general_ci
                  AND a.attribute = l.attribute COLLATE utf8mb4_general_ci
              )
        ");

        // 2. radreply ← legacy radreply, filtered to NAS-honored attributes.
        DB::statement("
            INSERT INTO airlink.radreply (username, attribute, op, value)
            SELECT l.username, l.attribute, l.op, l.value
            FROM airlink_legacy.radreply l
            WHERE {$safeReplyWhere}
              AND l.username IN (SELECT username FROM airlink_legacy.tbl_customers)
              AND NOT EXISTS (
                SELECT 1 FROM airlink.radreply a
                WHERE a.username = l.username COLLATE utf8mb4_general_ci
                  AND a.attribute = l.attribute COLLATE utf8mb4_general_ci
              )
        ");

        return [
            'radcheck' => DB::table('radcheck')->count(),
            'radreply' => DB::table('radreply')->count(),
            'note' => 'legacy counter attrs (Total-Volume-Limit etc.) intentionally excluded from radreply; captured in plans/vouchers',
        ];
    }

    private function radiusCandidateCounts(): array
    {
        $out = [];
        foreach (['radcheck', 'radreply'] as $t) {
            $out[$t.'_candidates'] = DB::connection('legacy')->table($t)
                ->whereIn('username', fn ($q) => $q->from('tbl_customers')->select('username'))
                ->count();
        }

        return $out;
    }

    // ---- Report ------------------------------------------------------------

    private function writeReport(bool $dry): void
    {
        $this->report['meta'] = ['dry_run' => $dry, 'generated_at' => now()->toIso8601String()];
        $path = storage_path('app/legacy-import-report.json');
        file_put_contents($path, json_encode($this->report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        $this->info("Review report written to: {$path}");
    }

    private function renderSummary(): void
    {
        $this->newLine();
        $this->line('<comment>Import summary</comment>');
        $this->table(['Entity', 'Result'], [
            ['Plans', ($this->report['plans']['imported'] ?? 0).' imported'],
            ['Staff users', count($this->report['users'] ?? []).' imported'],
            ['Wallets', count($this->report['wallets'] ?? []).' processed'],
            ['Vouchers', ($this->report['vouchers']['imported'] ?? 0).' imported, '.($this->report['vouchers']['skipped_no_plan'] ?? 0).' skipped'],
            ['Batches', ($this->report['vouchers']['batches'] ?? 0).' created'],
            ['radcheck', json_encode($this->report['radius'] ?? [])],
        ]);

        $this->newLine();
        $this->line('<comment>Hierarchy (REVIEW — correct parents/roles in the UI):</comment>');
        foreach ($this->report['hierarchy'] ?? [] as $h) {
            $this->line("  {$h['user']} ({$h['role']}) → parent {$h['parent']}  [{$h['confidence']}]");
        }
    }
}

/** Internal signal to roll back a dry-run transaction. */
class DryRunComplete extends \RuntimeException {}
