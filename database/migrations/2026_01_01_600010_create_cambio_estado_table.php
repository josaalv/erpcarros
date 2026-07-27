<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cambio_estado', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('vehiculo_id');
            $table->enum('eje', ['proceso', 'ubicacion', 'comercial', 'documental']);
            $table->string('valor_anterior', 60)->nullable();
            $table->string('valor_nuevo', 60);
            $table->string('nota', 255)->nullable();
            $table->unsignedBigInteger('usuario_id')->nullable();
            $table->dateTime('ocurrido')->useCurrent();

            $table->index(['vehiculo_id', 'ocurrido'], 'ix_ce_veh');
            $table->foreign('vehiculo_id', 'fk_ce_veh')->references('id')->on('vehiculo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cambio_estado');
    }
};
