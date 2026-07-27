<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cita', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('prospecto_id');
            $table->unsignedBigInteger('vehiculo_id')->nullable();
            $table->dateTime('cuando');
            $table->string('lugar', 120)->nullable();
            $table->enum('estado', ['programada', 'asistio', 'no_asistio', 'cancelada'])->default('programada');

            SchemaHelpers::bloqueEstandar($table);

            $table->index('cuando', 'ix_cita_cuando');
            $table->foreign('prospecto_id', 'fk_cita_prosp')->references('id')->on('prospecto');
            $table->foreign('vehiculo_id', 'fk_cita_veh')->references('id')->on('vehiculo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cita');
    }
};
