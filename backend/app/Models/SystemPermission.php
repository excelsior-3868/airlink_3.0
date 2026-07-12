<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemPermission extends Model
{
    protected $fillable = [
        'feature',
        'display_name',
        'category',
        'description',
        'admin',
        'reseller',
        'seller',
    ];

    protected $casts = [
        'admin' => 'boolean',
        'reseller' => 'boolean',
        'seller' => 'boolean',
    ];

    /**
     * Check if a role is allowed to perform this feature.
     */
    public static function isAllowed(string $feature, string $role): bool
    {
        $perm = self::where('feature', $feature)->first();
        if (!$perm) {
            // Default fallbacks if permission record is missing
            if ($role === 'admin') return true;
            if ($feature === 'generate_voucher' || $feature === 'dashboard') return true;
            return false;
        }

        return (bool) $perm->getAttribute($role);
    }
}
