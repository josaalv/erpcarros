<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('movimiento', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('vehiculo_id');
            $table->unsignedBigInteger('origen_id')->nullable();
            $table->unsignedBigInteger('destino_id');
            $table->string('motivo', 255)->nullable();
            $table->string('evidencia_path', 255)->nullable();
            $table->text('observaciones')->nullable();
            $table->unsignedBigInteger('usuario_id')->nullable();
            $table->dateTime('ocurrido')->useCurrent();

            $table->index(['vehiculo_id', 'ocurrido'], 'ix_mov_veh');
            $table->foreign('vehiculo_id', 'fk_mov_veh')->references('id')->on('vehiculo');
            $table->foreign('origen_id', 'fk_mov_origen')->references('id')->on('ubicacion');
            $table->foreign('destino_id', 'fk_mov_destino')->references('id')->on('ubicacion');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('movimiento');
    }
};
