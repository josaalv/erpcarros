<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Historial, no un campo (RN-21): cuantas veces, cuando, quien y por que.
        Schema::create('reapertura', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cierre_id');
            $table->string('motivo', 255);
            $table->unsignedBigInteger('usuario_id');
            $table->dateTime('ocurrido')->useCurrent();
            $table->dateTime('cerrado_de_nuevo')->nullable();

            $table->index('cierre_id', 'ix_reap_cierre');
            $table->foreign('cierre_id', 'fk_reap_cierre')->references('id')->on('cierre_financiero');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reapertura');
    }
};
