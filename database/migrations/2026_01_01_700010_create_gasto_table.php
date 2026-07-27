<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // La tabla mas importante de la base de datos (RN-01): si esta
        // captura bien, todo lo demas se deriva.
        Schema::create('gasto', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('vehiculo_id'); // NUNCA nulo (RN-01)
            $table->unsignedBigInteger('categoria_id');
            $table->unsignedBigInteger('orden_trabajo_id')->nullable();
            $table->unsignedBigInteger('proveedor_id')->nullable();
            $table->string('descripcion', 255);
            $table->decimal('importe', 12, 2);
            $table->date('fecha');
            $table->enum('forma_pago', ['efectivo', 'transferencia', 'credito', 'otro'])->nullable();
            $table->enum('estado_pago', ['pagado', 'pendiente'])->default('pagado');
            $table->enum('pagador_tipo', ['empresa', 'socio'])->default('empresa');
            $table->unsignedBigInteger('pagador_socio_id')->nullable(); // requerido si tipo = socio
            $table->string('comprobante_path', 255)->nullable();
            $table->string('observaciones', 255)->nullable();

            SchemaHelpers::bloqueEstandar($table);

            $table->index(['vehiculo_id', 'fecha'], 'ix_gasto_veh');
            $table->index('categoria_id', 'ix_gasto_cat');
            $table->index('estado_pago', 'ix_gasto_estado');
            $table->index('pagador_socio_id', 'ix_gasto_socio');
            $table->foreign('vehiculo_id', 'fk_gasto_veh')->references('id')->on('vehiculo');
            $table->foreign('categoria_id', 'fk_gasto_cat')->references('id')->on('categoria_gasto');
            $table->foreign('orden_trabajo_id', 'fk_gasto_ot')->references('id')->on('orden_trabajo');
            $table->foreign('proveedor_id', 'fk_gasto_prov')->references('id')->on('proveedor');
            $table->foreign('pagador_socio_id', 'fk_gasto_socio')->references('id')->on('socio');
        });

        DB::statement('ALTER TABLE gasto ADD CONSTRAINT ck_gasto_importe CHECK (importe >= 0)');
        DB::statement("ALTER TABLE gasto ADD CONSTRAINT ck_gasto_pagador CHECK (
            (pagador_tipo = 'socio' AND pagador_socio_id IS NOT NULL) OR
            (pagador_tipo = 'empresa' AND pagador_socio_id IS NULL)
        )");
    }

    public function down(): void
    {
        Schema::dropIfExists('gasto');
    }
};
