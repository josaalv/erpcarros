<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comision', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('venta_id');
            $table->unsignedBigInteger('comisionista_id');
            $table->enum('esquema', ['fijo', 'porcentaje_venta', 'porcentaje_utilidad', 'especial'])->default('fijo');
            $table->decimal('valor_esquema', 12, 4)->nullable(); // monto o fraccion segun esquema
            $table->decimal('monto_estimado', 12, 2)->nullable();
            $table->decimal('monto_autorizado', 12, 2)->nullable(); // solo con condiciones RN-18
            $table->unsignedBigInteger('autorizado_por')->nullable();
            $table->date('fecha_autorizacion')->nullable();
            $table->decimal('monto_pagado', 12, 2)->nullable();
            $table->date('fecha_pago')->nullable();
            $table->enum('metodo_pago', ['efectivo', 'transferencia', 'otro'])->nullable();
            $table->string('comprobante_path', 255)->nullable();

            SchemaHelpers::bloqueEstandar($table);

            $table->index('comisionista_id', 'ix_comision_com');
            $table->foreign('venta_id', 'fk_comision_venta')->references('id')->on('venta');
            $table->foreign('comisionista_id', 'fk_comision_com')->references('id')->on('comisionista');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comision');
    }
};
