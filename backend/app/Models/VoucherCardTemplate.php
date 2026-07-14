<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VoucherCardTemplate extends Model
{
    protected $fillable = ['width', 'height', 'background_data', 'elements'];

    protected $casts = [
        'width' => 'integer',
        'height' => 'integer',
        'elements' => 'array',
    ];

    /**
     * The single global template, or a sensible default matching the shipped
     * prepaid WiFi card artwork when none has been configured yet.
     */
    public static function active(): self
    {
        $tpl = self::query()->orderBy('id')->first();
        if ($tpl) {
            return $tpl;
        }

        $t = new self(self::defaults());
        $t->exists = false;

        return $t;
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
