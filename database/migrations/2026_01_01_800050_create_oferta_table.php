<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // SOLO la captura el administrador (RN-14).
        Schema::create('oferta', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('prospecto_id');
            $table->unsignedBigInteger('vehiculo_id');
            $table->decimal('monto', 12, 2);
            $table->date('fecha');
            $table->enum('estado', ['recibida', 'aceptada', 'rechazada', 'contraoferta'])->default('recibida');
            $table->string('nota', 255)->nullable();

            SchemaHelpers::bloqueEstandar($table);

            $table->index('vehiculo_id', 'ix_oferta_veh');
            $table->foreign('prospecto_id', 'fk_oferta_prosp')->references('id')->on('prospecto');
            $table->foreign('vehiculo_id', 'fk_oferta_veh')->references('id')->on('vehiculo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('oferta');
    }
};
