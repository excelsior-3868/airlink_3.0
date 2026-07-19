<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Season;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SeasonController extends Controller
{
    /** List all seasons. */
    public function index(): JsonResponse
    {
        $seasons = Season::all();
        return $this->ok($seasons);
    }

    /** Update a season's duration. */
    public function update(Request $request, Season $season): JsonResponse
    {
        $data = $request->validate([
            'start_month' => ['required', 'integer', 'min:1', 'max:12'],
            'start_day' => ['required', 'integer', 'min:1', 'max:31'],
            'end_month' => ['required', 'integer', 'min:1', 'max:12'],
            'end_day' => ['required', 'integer', 'min:1', 'max:31'],
        ]);

        $season->update($data);

        return $this->ok($season, 'Season duration updated successfully.');
    }
}
