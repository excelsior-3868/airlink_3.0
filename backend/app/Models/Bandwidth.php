<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Bandwidth extends Model
{
    protected $guarded = [];

    public function plans(): HasMany
    {
        return $this->hasMany(InternetPlan::class, 'bandwidth_id');
    }
}
