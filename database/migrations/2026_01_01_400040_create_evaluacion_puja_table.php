<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // La calculadora de puja (RN-05). Guarda tambien las pujas perdidas
        // y descartadas: sin ellas no se puede calibrar el criterio de compra.
        Schema::create('evaluacion_puja', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('subasta_id')->nullable();
            $table->unsignedBigInteger('vehiculo_id')->nullable(); // se llena solo si se gana
            $table->string('marca', 50); // duplicado a proposito: la evaluacion existe sin vehiculo
            $table->string('modelo', 60);
            $table->unsignedSmallInteger('anio');
            $table->text('danos_observados')->nullable();
            $table->decimal('costo_reparacion_estimado', 12, 2)->default(0);
            $table->decimal('precio_venta_esperado', 12, 2)->default(0);
            $table->decimal('techo_puja', 12, 2)->nullable();
            $table->decimal('roi_proyectado', 7, 4)->nullable();
            $table->decimal('roi_historico_segmento', 7, 4)->nullable(); // congelado al momento de evaluar
            $table->boolean('advertencia_mostrada')->default(false);
            $table->enum('resultado', ['pendiente', 'ganada', 'perdida', 'descartada'])->default('pendiente');

            SchemaHelpers::bloqueEstandar($table);

            $table->index('vehiculo_id', 'ix_eval_veh');
            $table->index(['marca', 'modelo', 'anio'], 'ix_eval_segmento');
            $table->foreign('subasta_id', 'fk_eval_subasta')->references('id')->on('subasta');
            $table->foreign('vehiculo_id', 'fk_eval_veh')->references('id')->on('vehiculo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('evaluacion_puja');
    }
};
