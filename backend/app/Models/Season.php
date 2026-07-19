<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Season extends Model
{
    protected $fillable = [
        'name',
        'start_month',
        'start_day',
        'end_month',
        'end_day',
    ];
}
