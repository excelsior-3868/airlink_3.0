<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreditBillingTest extends TestCase
{
    use RefreshDatabase;

    public function test_gb_allocation_creates_invoice_and_increases_wallet_due(): void
    {
        $admin = $this->makeUser('admin', ['gb_balance' => 5000]);
        $reseller = $this->makeUser('reseller', ['parent_id' => $admin->id, 'gb_rate' => 120.00]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/gb/allocate', [
                'user_id' => $reseller->id,
                'gb_amount' => 100,
            ])
            ->assertOk();

        // Admin balance decremented
        $this->assertEquals(4900, $admin->fresh()->gb_balance);
        
        // Reseller balance incremented
        $this->assertEquals(100, $reseller->fresh()->gb_balance);

        // Reseller wallet due increased by 100 GB * Rs. 120 = Rs. 12,000
        $this->assertEquals(12000, $reseller->fresh()->wallet_due);

        // Invoice created
        $invoice = Invoice::where('receiver_id', $reseller->id)->first();
        $this->assertNotNull($invoice);
        $this->assertEquals(100, $invoice->gb_amount);
        $this->assertEquals(120, $invoice->rate);
        $this->assertEquals(12000, $invoice->total_amount);
        $this->assertEquals('due', $invoice->status);
    }

    public function test_payment_collection_reduces_due_and_pays_off_invoices(): void
    {
        $admin = $this->makeUser('admin');
        $reseller = $this->makeUser('reseller', ['parent_id' => $admin->id, 'wallet_due' => 15000]);

        // Mock two invoices for reseller
        Invoice::create([
            'invoice_number' => 'INV-TEST-1',
            'sender_id' => $admin->id,
            'receiver_id' => $reseller->id,
            'gb_amount' => 50,
            'rate' => 100,
            'total_amount' => 5000,
            'status' => 'due',
            'paid_amount' => 0,
        ]);

        Invoice::create([
            'invoice_number' => 'INV-TEST-2',
            'sender_id' => $admin->id,
            'receiver_id' => $reseller->id,
            'gb_amount' => 100,
            'rate' => 100,
            'total_amount' => 10000,
            'status' => 'due',
            'paid_amount' => 0,
        ]);

        // Collect payment of Rs 8,000
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/billing/payments/collect', [
                'user_id' => $reseller->id,
                'amount' => 8000,
                'note' => 'Collected partial payment',
            ])
            ->assertOk();

        // Reseller wallet due reduced: 15,000 - 8,000 = 7,000
        $this->assertEquals(7000, $reseller->fresh()->wallet_due);

        // Payment record created
        $payment = Payment::where('sender_id', $reseller->id)->first();
        $this->assertNotNull($payment);
        $this->assertEquals(8000, $payment->amount);

        // Oldest invoice (INV-TEST-1) fully paid
        $inv1 = Invoice::where('invoice_number', 'INV-TEST-1')->first();
        $this->assertEquals('paid', $inv1->status);
        $this->assertEquals(5000, $inv1->paid_amount);

        // Second invoice (INV-TEST-2) partially paid: remaining 3,000 applied
        $inv2 = Invoice::where('invoice_number', 'INV-TEST-2')->first();
        $this->assertEquals('due', $inv2->status);
        $this->assertEquals(3000, $inv2->paid_amount);
    }
}
