<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\User;

class VoucherCardTemplate extends Model
{
    protected $fillable = ['user_id', 'width', 'height', 'background_data', 'elements'];

    protected $casts = [
        'user_id' => 'integer',
        'width' => 'integer',
        'height' => 'integer',
        'elements' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Resolve a template hierarchically for a user:
     * 1. Specific template for this user.
     * 2. Parent reseller template (if user is a seller).
     * 3. Global template (user_id = null).
     * 4. Hardcoded defaults.
     */
    public static function activeForUser(?User $user): self
    {
        if ($user) {
            $tpl = self::query()->where('user_id', $user->id)->first();
            if ($tpl) {
                return $tpl;
            }

            if ($user->isSeller() && $user->parent_id) {
                $tpl = self::query()->where('user_id', $user->parent_id)->first();
                if ($tpl) {
                    return $tpl;
                }
            }
        }

        $tpl = self::query()->whereNull('user_id')->first();
        if ($tpl) {
            return $tpl;
        }

        $t = new self(self::defaults());
        $t->exists = false;

        return $t;
    }

    /**
     * Backward-compatible active template resolver using current request user.
     */
    public static function active(): self
    {
        return self::activeForUser(request()->user());
    }

    /**
     * Default design — mirrors the legacy hardcoded card so cards look right
     * out of the box. Positions are percentages of width/height; font_size is
     * in design pixels relative to `width`.
     */
    public static function defaults(): array
    {
        return [
            'width' => 360,
            'height' => 225,
            'background_data' => null,
            'elements' => [
                ['id' => 'prepaid', 'field' => 'text', 'text' => 'PREPAID', 'x' => 6, 'y' => 14, 'font_size' => 13, 'color' => '#ffffff', 'weight' => 700, 'align' => 'left', 'underline' => false, 'letter_spacing' => 2, 'font' => 'sans', 'shadow' => true],
                ['id' => 'wifi', 'field' => 'text', 'text' => 'WIFI CARD', 'x' => 6, 'y' => 26, 'font_size' => 29, 'color' => '#ffffff', 'weight' => 900, 'align' => 'left', 'underline' => false, 'letter_spacing' => 0, 'font' => 'sans', 'shadow' => true],
                ['id' => 'price', 'field' => 'price', 'text' => '', 'x' => 94, 'y' => 28, 'font_size' => 21, 'color' => '#111111', 'weight' => 800, 'align' => 'right', 'underline' => false, 'letter_spacing' => 0, 'font' => 'sans', 'shadow' => false],
                ['id' => 'credlabel', 'field' => 'text', 'text' => 'Username & Password', 'x' => 6, 'y' => 56, 'font_size' => 15, 'color' => '#ffffff', 'weight' => 700, 'align' => 'left', 'underline' => true, 'letter_spacing' => 0, 'font' => 'sans', 'shadow' => true],
                ['id' => 'code', 'field' => 'code', 'text' => '', 'x' => 6, 'y' => 72, 'font_size' => 26, 'color' => '#ffffff', 'weight' => 900, 'align' => 'left', 'underline' => false, 'letter_spacing' => 3, 'font' => 'mono', 'shadow' => true],
                ['id' => 'plan', 'field' => 'plan_name', 'text' => '', 'x' => 6, 'y' => 92, 'font_size' => 16, 'color' => '#ffffff', 'weight' => 700, 'align' => 'left', 'underline' => false, 'letter_spacing' => 0, 'font' => 'sans', 'shadow' => true],
            ],
        ];
    }
}
