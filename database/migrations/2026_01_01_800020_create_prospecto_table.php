<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prospecto', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cliente_id');
            $table->unsignedBigInteger('vehiculo_id')->nullable();
            $table->unsignedBigInteger('comisionista_id')->nullable(); // quien lo refirio
            $table->enum('etapa', [
                'nuevo', 'contactado', 'interesado', 'cita', 'visito',
                'prueba', 'oferta', 'negociacion', 'apartado',
                'vendido', 'perdido', 'cancelado',
            ])->default('nuevo');
            $table->date('fecha_registro');
            $table->date('vence_atribucion')->nullable(); // 15 dias (RN-13)
            $table->string('motivo_perdida', 255)->nullable();

            SchemaHelpers::bloqueEstandar($table);

            $table->index('cliente_id', 'ix_prosp_cliente');
            $table->index('vehiculo_id', 'ix_prosp_veh');
            $table->index('comisionista_id', 'ix_prosp_com');
            $table->index('etapa', 'ix_prosp_etapa');
            $table->foreign('cliente_id', 'fk_prosp_cliente')->references('id')->on('cliente');
            $table->foreign('vehiculo_id', 'fk_prosp_veh')->references('id')->on('vehiculo');
            $table->foreign('comisionista_id', 'fk_prosp_com')->references('id')->on('comisionista');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prospecto');
    }
};
