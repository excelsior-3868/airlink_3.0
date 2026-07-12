<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Standard FreeRADIUS 3.x SQL schema, living in the app DB (airlink) so the
 * radius container and the app share one database. Column names/types match
 * the upstream schema exactly — the freeradius rlm_sql module expects them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('radcheck', function (Blueprint $table) {
            $table->increments('id');
            $table->string('username', 64)->default('')->index();
            $table->string('attribute', 64)->default('');
            $table->char('op', 2)->default(':=');
            $table->string('value', 253)->default('');
        });

        Schema::create('radreply', function (Blueprint $table) {
            $table->increments('id');
            $table->string('username', 64)->default('')->index();
            $table->string('attribute', 64)->default('');
            $table->char('op', 2)->default('=');
            $table->string('value', 253)->default('');
        });

        Schema::create('radgroupcheck', function (Blueprint $table) {
            $table->increments('id');
            $table->string('groupname', 64)->default('')->index();
            $table->string('attribute', 64)->default('');
            $table->char('op', 2)->default('==');
            $table->string('value', 253)->default('');
        });

        Schema::create('radgroupreply', function (Blueprint $table) {
            $table->increments('id');
            $table->string('groupname', 64)->default('')->index();
            $table->string('attribute', 64)->default('');
            $table->char('op', 2)->default('=');
            $table->string('value', 253)->default('');
        });

        Schema::create('radusergroup', function (Blueprint $table) {
            $table->increments('id');
            $table->string('username', 64)->default('')->index();
            $table->string('groupname', 64)->default('');
            $table->integer('priority')->default(1);
        });

        Schema::create('nas', function (Blueprint $table) {
            $table->increments('id');
            $table->string('nasname', 128)->index();
            $table->string('shortname', 32)->nullable();
            $table->string('type', 30)->default('other');
            $table->integer('ports')->nullable();
            $table->string('secret', 60)->default('secret');
            $table->string('server', 64)->nullable();
            $table->string('community', 50)->nullable();
            $table->string('description', 200)->default('RADIUS Client');
        });

        Schema::create('radacct', function (Blueprint $table) {
            $table->bigIncrements('radacctid');
            $table->string('acctsessionid', 64)->default('');
            $table->string('acctuniqueid', 32)->default('')->unique();
            $table->string('username', 64)->default('')->index();
            $table->string('realm', 64)->nullable()->default('');
            $table->string('nasipaddress', 15)->default('')->index();
            $table->string('nasportid', 32)->nullable();
            $table->string('nasporttype', 32)->nullable();
            $table->dateTime('acctstarttime')->nullable()->index();
            $table->dateTime('acctupdatetime')->nullable();
            $table->dateTime('acctstoptime')->nullable()->index();
            $table->integer('acctinterval')->nullable()->index();
            $table->unsignedInteger('acctsessiontime')->nullable()->index();
            $table->string('acctauthentic', 32)->nullable();
            $table->string('connectinfo_start', 128)->nullable();
            $table->string('connectinfo_stop', 128)->nullable();
            $table->bigInteger('acctinputoctets')->nullable();
            $table->bigInteger('acctoutputoctets')->nullable();
            $table->string('calledstationid', 50)->default('');
            $table->string('callingstationid', 50)->default('');
            $table->string('acctterminatecause', 32)->default('');
            $table->string('servicetype', 32)->nullable();
            $table->string('framedprotocol', 32)->nullable();
            $table->string('framedipaddress', 15)->default('')->index();
            $table->string('framedipv6address', 45)->default('');
            $table->string('framedipv6prefix', 45)->default('');
            $table->string('framedinterfaceid', 44)->default('');
            $table->string('delegatedipv6prefix', 45)->default('');
            $table->string('class', 64)->nullable()->index();
            $table->index('acctsessionid');
        });

        Schema::create('radpostauth', function (Blueprint $table) {
            $table->increments('id');
            $table->string('username', 64)->default('')->index();
            $table->string('pass', 64)->default('');
            $table->string('reply', 32)->default('');
            $table->timestamp('authdate')->useCurrent();
            $table->string('class', 64)->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('radpostauth');
        Schema::dropIfExists('radacct');
        Schema::dropIfExists('nas');
        Schema::dropIfExists('radusergroup');
        Schema::dropIfExists('radgroupreply');
        Schema::dropIfExists('radgroupcheck');
        Schema::dropIfExists('radreply');
        Schema::dropIfExists('radcheck');
    }
};
