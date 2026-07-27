<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Subestados de taller: simultaneos y no excluyentes en una unidad.
        Schema::create('vehiculo_subestado', function (Blueprint $table) {
            $table->unsignedBigInteger('vehiculo_id');
            $table->unsignedBigInteger('subestado_id');
            $table->dateTime('desde')->useCurrent();
            $table->dateTime('hasta')->nullable();

            $table->primary(['vehiculo_id', 'subestado_id', 'desde']);
            $table->foreign('vehiculo_id', 'fk_vs_veh')->references('id')->on('vehiculo')->cascadeOnDelete();
            $table->foreign('subestado_id', 'fk_vs_sub')->references('id')->on('subestado_taller');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehiculo_subestado');
    }
};
