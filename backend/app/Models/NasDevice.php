<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NasDevice extends Model
{
    protected $guarded = [];

    protected $hidden = ['secret', 'api_password'];
}
