<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VoucherCardTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VoucherTemplateController extends Controller
{
    /** The global voucher card design (or defaults). Readable by all authed users. */
    public function index(): JsonResponse
    {
        $t = VoucherCardTemplate::active();

        return $this->ok([
            'width' => $t->width,
            'height' => $t->height,
            'background_data' => $t->background_data,
            'elements' => $t->elements ?? [],
        ]);
    }

    /** Save the global voucher card design. Admin only (gated at the route). */
    public function save(Request $request): JsonResponse
    {
        $data = $request->validate([
            'width' => ['required', 'integer', 'min:120', 'max:2000'],
            'height' => ['required', 'integer', 'min:80', 'max:2000'],
            // data URI (data:image/...;base64,....) — cap ~10MB image (base64 inflates ~33%).
            // Null/empty clears to default art.
            'background_data' => ['sometimes', 'nullable', 'string', 'max:14000000'],
            'elements' => ['present', 'array'],
            'elements.*.id' => ['required', 'string', 'max:40'],
            'elements.*.field' => ['required', 'in:text,price,code,plan_name,username,password,image'],
            'elements.*.text' => ['nullable', 'string', 'max:120'],
            'elements.*.x' => ['required', 'numeric', 'min:0', 'max:100'],
            'elements.*.y' => ['required', 'numeric', 'min:0', 'max:100'],
            'elements.*.font_size' => ['required', 'numeric', 'min:4', 'max:200'],
            'elements.*.color' => ['required', 'string', 'max:9'],
            'elements.*.weight' => ['required', 'integer', 'min:100', 'max:900'],
            'elements.*.align' => ['required', 'in:left,center,right'],
            'elements.*.underline' => ['boolean'],
            'elements.*.letter_spacing' => ['nullable', 'numeric', 'min:0', 'max:40'],
            'elements.*.font' => ['required', 'in:sans,mono'],
            'elements.*.shadow' => ['boolean'],
            // Logo / image element — data URI and width as % of the card width.
            'elements.*.image_data' => ['nullable', 'string', 'max:4000000'],
            'elements.*.width' => ['nullable', 'numeric', 'min:1', 'max:100'],
        ]);

        $tpl = VoucherCardTemplate::query()->orderBy('id')->first() ?? new VoucherCardTemplate();
        $tpl->fill([
            'width' => $data['width'],
            'height' => $data['height'],
            'elements' => $data['elements'],
        ]);
        // Set the background exactly as sent: a data URI keeps a custom image,
        // null/empty reverts to the shipped default artwork.
        if ($request->has('background_data')) {
            $bg = $data['background_data'] ?? null;
            $tpl->background_data = ($bg && str_starts_with($bg, 'data:image/')) ? $bg : null;
        }
        $tpl->save();

        return $this->ok(null, 'Voucher card design saved.');
    }
}
