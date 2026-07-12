<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoginLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LoginLogController extends Controller
{
    /** List login logs, paginated (admin only). */
    public function index(Request $request): JsonResponse
    {
        $q = LoginLog::query();

        if ($search = $request->query('search')) {
            $q->where('username', 'like', "%$search%");
        }
        if ($request->has('successful')) {
            $q->where('successful', $request->boolean('successful'));
        }

        $logs = $q->orderByDesc('id')->paginate($request->integer('per_page', 25));

        return $this->ok($logs);
    }
}
