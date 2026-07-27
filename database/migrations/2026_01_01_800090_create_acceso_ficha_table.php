<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Trazabilidad del portal de comisionistas (RN-24).
        Schema::create('acceso_ficha', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('comisionista_id');
            $table->unsignedBigInteger('vehiculo_id');
            $table->enum('accion', ['consulto', 'descargo', 'compartio']);
            $table->dateTime('ocurrido')->useCurrent();

            $table->index(['comisionista_id', 'vehiculo_id', 'ocurrido'], 'ix_af');
            $table->foreign('comisionista_id', 'fk_af_com')->references('id')->on('comisionista');
            $table->foreign('vehiculo_id', 'fk_af_veh')->references('id')->on('vehiculo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('acceso_ficha');
    }
};
