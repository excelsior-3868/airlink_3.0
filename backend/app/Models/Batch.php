<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Batch extends Model
{
    protected $guarded = [];

    public function plan(): BelongsTo
    {
        return $this->belongsTo(InternetPlan::class, 'plan_id');
    }

    public function generatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }

    public function vouchers(): HasMany
    {
        return $this->hasMany(Voucher::class);
    }
}
