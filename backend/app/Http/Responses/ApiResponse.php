<?php

namespace App\Http\Responses;

use Illuminate\Http\JsonResponse;

/**
 * Consistent response envelope for the whole API:
 *   success → { "success": true,  "data": ..., "message": ... }
 *   error   → { "success": false, "message": ..., "errors": ... }
 */
trait ApiResponse
{
    protected function ok($data = null, ?string $message = null, int $status = 200): JsonResponse
    {
        return response()->json(array_filter([
            'success' => true,
            'data' => $data,
            'message' => $message,
        ], fn ($v) => $v !== null), $status);
    }

    protected function created($data = null, ?string $message = 'Created'): JsonResponse
    {
        return $this->ok($data, $message, 201);
    }

    protected function fail(string $message, int $status = 400, $errors = null): JsonResponse
    {
        return response()->json(array_filter([
            'success' => false,
            'message' => $message,
            'errors' => $errors,
        ], fn ($v) => $v !== null), $status);
    }
}
