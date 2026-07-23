<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'party_id', 'party_name', 'category', 'amount',
    'expense_date', 'payment_method', 'reference', 'note', 'created_by',
])]
class Expense extends Model
{
    use HasFactory;

    protected $fillable = [
        'party_id',
        'party_name',
        'category',
        'amount',
        'expense_date',
        'payment_method',
        'reference',
        'note',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'expense_date' => 'date',
        ];
    }

    public function party(): BelongsTo
    {
        return $this->belongsTo(Party::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
