<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('wallet_due', 14, 2)->default(0.00)->after('wallet_balance');   // Outstanding dues
            $table->decimal('gb_rate', 10, 2)->default(100.00)->after('gb_balance');      // Customizable rate per GB set by Admin
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_number')->unique();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('receiver_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('gb_amount', 14, 3);
            $table->decimal('rate', 10, 2);
            $table->decimal('total_amount', 14, 2);
            $table->enum('status', ['due', 'paid'])->default('due');
            $table->decimal('paid_amount', 14, 2)->default(0.00);
            $table->timestamps();

            $table->index('sender_id');
            $table->index('receiver_id');
            $table->index('status');
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();   // Downline user paying
            $table->foreignId('receiver_id')->constrained('users')->cascadeOnDelete(); // Upline user receiving
            $table->decimal('amount', 14, 2);
            $table->timestamp('payment_date');
            $table->string('note')->nullable();
            $table->timestamps();

            $table->index('sender_id');
            $table->index('receiver_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('invoices');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['wallet_due', 'gb_rate']);
        });
    }
};
