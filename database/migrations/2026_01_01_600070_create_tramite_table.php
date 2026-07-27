<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Nota: no guarda costo. El dinero vive siempre en 'gasto', en un solo lugar.
        Schema::create('tramite', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('vehiculo_id');
            $table->string('tipo', 80); // cambio de propietario, placas, tenencias
            $table->unsignedBigInteger('gestor_id')->nullable(); // proveedor con es_gestor = 1
            $table->date('fecha_envio')->nullable();
            $table->date('fecha_estimada')->nullable();
            $table->date('fecha_real')->nullable();
            $table->enum('estado', ['pendiente', 'en_proceso', 'terminado', 'detenido'])->default('pendiente');
            $table->text('observaciones')->nullable();

            SchemaHelpers::bloqueEstandar($table);

            $table->index('vehiculo_id', 'ix_tramite_veh');
            $table->index('estado', 'ix_tramite_estado');
            $table->foreign('vehiculo_id', 'fk_tramite_veh')->references('id')->on('vehiculo');
            $table->foreign('gestor_id', 'fk_tramite_gestor')->references('id')->on('proveedor');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tramite');
    }
};
