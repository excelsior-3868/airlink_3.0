<?php

namespace App\Http\Middleware;

use App\Models\SystemPermission;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    /**
     * Handle an incoming request. Checks the database system_permissions table
     * to see if the user's role has access to the specified feature.
     */
    public function handle(Request $request, Closure $next, string $feature): Response
    {
        $user = $request->user();

        if (! $user || ! SystemPermission::isAllowed($feature, $user->role)) {
            return response()->json([
                'success' => false,
                'message' => "This action is not permitted for your role: access to '{$feature}' is restricted by system policy.",
            ], 403);
        }

        return $next($request);
    }
}
