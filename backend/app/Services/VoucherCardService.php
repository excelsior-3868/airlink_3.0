<?php

namespace App\Services;

use App\Models\Voucher;
use Endroid\QrCode\QrCode;
use Endroid\QrCode\Writer\PngWriter;

/**
 * Renders a printable voucher card as a PNG (QR + code + plan + T&C) using GD.
 * Fonts use GD's built-ins so no TTF dependency is needed in the container.
 */
class VoucherCardService
{
    public function png(Voucher $voucher): string
    {
        $W = 360;
        $H = 460;
        $card = imagecreatetruecolor($W, $H);

        $white = imagecolorallocate($card, 255, 255, 255);
        $blue = imagecolorallocate($card, 0, 74, 163);     // NT blue
        $dark = imagecolorallocate($card, 20, 30, 50);
        $grey = imagecolorallocate($card, 110, 120, 140);
        imagefill($card, 0, 0, $white);

        // Header band.
        imagefilledrectangle($card, 0, 0, $W, 56, $blue);
        $this->centerText($card, 5, 'AIRLINK WIFI', 18, $white, $W);
        $this->centerText($card, 3, 'Internet Voucher', 34, $white, $W);

        // Plan name.
        $this->centerText($card, 5, strtoupper($voucher->plan?->name ?? 'PLAN'), 72, $dark, $W);

        // QR code (encodes the login code).
        $qr = imagecreatefromstring($this->qrPng($voucher->code));
        $qrSize = 190;
        $qr = imagescale($qr, $qrSize, $qrSize);
        imagecopy($card, $qr, (int) (($W - $qrSize) / 2), 98, 0, 0, $qrSize, $qrSize);

        // The code, prominent.
        $this->centerText($card, 5, $voucher->code, 300, $blue, $W);

        // Details.
        $data = $voucher->data_gb ? rtrim(rtrim(number_format((float) $voucher->data_gb, 3), '0'), '.').' GB' : 'Unlimited';
        $this->centerText($card, 3, "Data: {$data}   Validity: {$voucher->validity_days} day(s)", 326, $dark, $W);
        $this->centerText($card, 3, 'Price: Rs '.number_format((float) $voucher->price, 2), 346, $dark, $W);

        // Divider + T&C.
        imageline($card, 24, 372, $W - 24, 372, $grey);
        $this->centerText($card, 2, 'Connect to Airlink WiFi, open the portal and', 384, $grey, $W);
        $this->centerText($card, 2, 'enter the code above to get online.', 400, $grey, $W);
        $this->centerText($card, 1, 'Non-refundable. Valid from first login. T&C apply.', 424, $grey, $W);

        ob_start();
        imagepng($card);
        $out = ob_get_clean();
        imagedestroy($card);

        return $out;
    }

    private function qrPng(string $data): string
    {
        $writer = new PngWriter();
        $qr = new QrCode(data: $data, size: 190, margin: 4);

        return $writer->write($qr)->getString();
    }

    private function centerText($img, int $font, string $text, int $y, int $color, int $width): void
    {
        $w = imagefontwidth($font) * strlen($text);
        imagestring($img, $font, (int) (($width - $w) / 2), $y, $text, $color);
    }
}
