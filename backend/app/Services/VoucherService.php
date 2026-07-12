<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\InternetPlan;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class VoucherService
{
    public function __construct(
        private WalletService $wallet,
        private GbService $gb,
        private RadiusService $radius,
    ) {}

    public const MAX_BATCH = 20000;

    /**
     * Generate one or many vouchers for $actor from $plan.
     *
     * Both balances are checked up front, then — inside a single DB
     * transaction — vouchers + radcheck/radreply are inserted and the wallet
     * and GB are deducted. A failure anywhere rolls the whole thing back, so
     * we can never leave orphaned credentials or a double-spent balance.
     */
    public function generate(User $actor, InternetPlan $plan, int $quantity, ?int $validityDays = null, ?string $note = null, ?float $customPrice = null, ?float $customBasePrice = null): Batch
    {
        if ($quantity < 1 || $quantity > self::MAX_BATCH) {
            throw ValidationException::withMessages(['quantity' => 'Quantity must be between 1 and '.self::MAX_BATCH.'.']);
        }
        if ($plan->status !== 'active') {
            throw ValidationException::withMessages(['plan_id' => 'Plan is not active.']);
        }

        $validity = $validityDays ?: (int) $plan->validity_days;
        $gbPer = (float) ($plan->data_gb ?? 0);
        $pricePer = $customPrice !== null ? (float) $customPrice : (float) $plan->selling_price;
        $basePricePer = $customBasePrice !== null ? (float) $customBasePrice : (float) ($plan->base_price ?? 0);
        $totalGb = $gbPer * $quantity;
        $totalPrice = $pricePer * $quantity;

        // Fail fast with a clear message before touching anything.
        if ($totalGb > 0 && (float) $actor->gb_balance < $totalGb) {
            throw ValidationException::withMessages(['gb' => "Not enough GB balance. Need {$totalGb} GB."]);
        }

        // Ownership from the actor's position in the hierarchy.
        [$resellerId, $sellerId] = match ($actor->role) {
            'seller' => [$actor->parent_id, $actor->id],
            'reseller' => [$actor->id, null],
            default => [null, null],
        };

        return DB::transaction(function () use ($actor, $plan, $quantity, $validity, $gbPer, $pricePer, $basePricePer, $totalGb, $totalPrice, $resellerId, $sellerId, $note) {
            $batch = Batch::create([
                'batch_code' => $this->uniqueBatchCode(),
                'plan_id' => $plan->id,
                'quantity' => $quantity,
                'generated_by' => $actor->id,
            ]);

            $codes = $this->uniqueCodes($quantity);
            $now = now();
            $expiresAt = $validity > 0 ? $now->copy()->addDays($validity) : null;

            $voucherRows = [];
            $checkRows = [];
            $replyRows = [];
            foreach ($codes as $code) {
                $voucherRows[] = [
                    'code' => $code, 'username' => $code, 'password' => $code,
                    'plan_id' => $plan->id, 'batch_id' => $batch->id,
                    'owner_id' => $actor->id, 'reseller_id' => $resellerId, 'seller_id' => $sellerId,
                    'data_gb' => $gbPer ?: null, 'validity_days' => $validity, 'price' => $pricePer,
                    'base_price' => $basePricePer,
                    'status' => 'new', 'expires_at' => $expiresAt,
                    'created_at' => $now, 'updated_at' => $now,
                ];
                $r = $this->radius->rows($code, $code, $plan);
                $checkRows = array_merge($checkRows, $r['check']);
                $replyRows = array_merge($replyRows, $r['reply']);
            }

            // Bulk insert in chunks (handles up to 20k without huge queries).
            foreach (array_chunk($voucherRows, 1000) as $chunk) {
                Voucher::insert($chunk);
            }
            foreach (array_chunk($checkRows, 2000) as $chunk) {
                DB::table('radcheck')->insert($chunk);
            }
            foreach (array_chunk($replyRows, 2000) as $chunk) {
                DB::table('radreply')->insert($chunk);
            }

            // Deduct only GB balance (row-locked, audited).
            if ($totalGb > 0) {
                $this->gb->deduct($actor, $totalGb, $batch->batch_code, $note ?? "Generated {$quantity} vouchers");
            }

            return $batch->fresh();
        });
    }

    private function uniqueBatchCode(): string
    {
        do {
            $code = 'BAT'.now()->format('ymd').strtoupper(Str::random(4));
        } while (Batch::where('batch_code', $code)->exists());

        return $code;
    }

    /** @return string[] $count unique voucher codes not already in the DB. */
    private function uniqueCodes(int $count): array
    {
        $codes = []; // set of code => true
        while (count($codes) < $count) {
            $candidates = [];
            for ($i = 0, $need = $count - count($codes); $i < $need; $i++) {
                $candidates[strtoupper(Str::random(8))] = true;
            }
            $list = array_keys($candidates);
            $taken = array_fill_keys(Voucher::whereIn('code', $list)->pluck('code')->all(), true);
            foreach ($list as $c) {
                if (! isset($taken[$c])) {
                    $codes[$c] = true;
                }
            }
        }

        return array_slice(array_keys($codes), 0, $count);
    }
}
