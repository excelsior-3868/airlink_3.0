<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VoucherCardTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VoucherTemplateController extends Controller
{
    /** The global or custom voucher card design (or defaults). Readable by all authed users. */
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $targetUser = $actor;

        if ($userId = $request->query('user_id')) {
            $user = \App\Models\User::find($userId);
            if ($user) {
                if ($actor->isAdmin()
                    || $actor->id === $user->id
                    || ($actor->isReseller() && $user->parent_id === $actor->id)
                ) {
                    $targetUser = $user;
                } else {
                    return $this->fail('Forbidden.', 403);
                }
            }
        }

        $t = VoucherCardTemplate::activeForUser($targetUser);

        return $this->ok([
            'width' => $t->width,
            'height' => $t->height,
            'background_data' => $t->background_data,
            'elements' => $t->elements ?? [],
            'is_custom' => $t->user_id !== null,
        ]);
    }

    /** Save the global or custom voucher card design. Open to all authenticated roles. */
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
            // Admin can specify a target reseller/seller to design on behalf of.
            'target_user_id' => ['sometimes', 'nullable', 'integer'],
        ]);

        $actor = $request->user();

        // Resolve which user's template to update.
        if ($actor->isAdmin() && !empty($data['target_user_id'])) {
            $target = \App\Models\User::find($data['target_user_id']);
            if (!$target || $target->role === 'admin') {
                return $this->fail('Invalid target user.', 422);
            }
            $tpl = VoucherCardTemplate::query()->where('user_id', $target->id)->first() ?? new VoucherCardTemplate();
            $tpl->user_id = $target->id;
        } elseif ($actor->isAdmin()) {
            // Saving the global default.
            $tpl = VoucherCardTemplate::query()->whereNull('user_id')->first() ?? new VoucherCardTemplate();
            $tpl->user_id = null;
        } else {
            // Reseller or seller saving their own custom design.
            $tpl = VoucherCardTemplate::query()->where('user_id', $actor->id)->first() ?? new VoucherCardTemplate();
            $tpl->user_id = $actor->id;
        }

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

    /** Revert a custom template back to default (deletes custom design for reseller/seller).
     *  Admin can pass ?user_id= to reset any specific user's template. */
    public function reset(Request $request): JsonResponse
    {
        $actor = $request->user();

        // Admin resetting another user's template.
        if ($actor->isAdmin() && $targetId = $request->query('user_id')) {
            VoucherCardTemplate::query()->where('user_id', $targetId)->delete();
            return $this->ok(null, 'Custom voucher card design reset to default.');
        }

        if ($actor->isAdmin()) {
            return $this->fail('Admin cannot reset the default design.', 422);
        }

        VoucherCardTemplate::query()->where('user_id', $actor->id)->delete();

        return $this->ok(null, 'Custom voucher card design reset to default.');
    }
}
