<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // App-facing registry of MikroTik routers / NAS devices (admin-managed).
    // Mirrors the standard FreeRADIUS `nas` table but with API creds the app
    // needs; the RadiusService keeps `nas` in sync from here.
    public function up(): void
    {
        Schema::create('nas_devices', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('nasname');                 // IP/hostname RADIUS sees
            $table->string('shortname')->nullable();
            $table->string('type')->default('mikrotik');
            $table->string('secret');                   // shared RADIUS secret
            $table->string('api_ip')->nullable();       // MikroTik API host
            $table->string('api_username')->nullable();
            $table->string('api_password')->nullable();
            $table->string('description')->nullable();
            $table->enum('status', ['active', 'disabled'])->default('active');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nas_devices');
    }
};
