<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gate a route to one or more roles: ->middleware('role:admin')
 * or ->middleware('role:admin,reseller').
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user || ($roles && ! in_array($user->role, $roles, true))) {
            return response()->json([
                'success' => false,
                'message' => 'This action is not permitted for your role.',
            ], 403);
        }

        return $next($request);
    }
}
