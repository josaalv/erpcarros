<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehiculo', function (Blueprint $table) {
            $table->id();
            $table->string('id_interno', 20); // V-0142
            $table->string('vin', 17)->nullable(); // puede faltar al inicio
            $table->string('marca', 50);
            $table->string('modelo', 60);
            $table->string('version', 60)->nullable();
            $table->unsignedSmallInteger('anio');
            $table->unsignedInteger('kilometraje')->nullable();
            $table->string('color', 40)->nullable();
            $table->enum('transmision', ['manual', 'automatica', 'otra'])->nullable();
            $table->string('motor', 60)->nullable();
            $table->text('equipamiento')->nullable();
            $table->text('descripcion_comercial')->nullable();
            $table->unsignedBigInteger('estado_proceso_id');
            $table->unsignedBigInteger('ubicacion_id');
            $table->enum('estado_comercial', [
                'no_publicado', 'publicado', 'en_consignacion',
                'con_referidos', 'apartado', 'vendido',
            ])->default('no_publicado');
            $table->enum('estado_documental', ['incompleto', 'en_tramite', 'completo'])->default('incompleto');
            $table->enum('regimen_factura', ['refacturada', 'endosada'])->nullable(); // se fija al alta (RN-09)
            $table->date('fecha_compra')->nullable(); // arranca dias de inventario (RN-04)
            $table->date('fecha_ingreso')->nullable(); // llegada fisica al taller
            $table->date('fecha_estimada_fin')->nullable();
            $table->date('fecha_real_fin')->nullable();
            $table->date('fecha_venta')->nullable();
            $table->date('fecha_entrega')->nullable();
            $table->decimal('precio_minimo', 12, 2)->nullable(); // SOLO ROL ADMIN
            $table->decimal('precio_autorizado', 12, 2)->nullable(); // venta directa
            $table->decimal('precio_lote', 12, 2)->nullable(); // asignado al lote (RN-27)
            $table->enum('canal_venta', ['directa', 'consignacion', 'comisionista', 'anuncio'])->nullable();

            SchemaHelpers::bloqueEstandar($table);

            $table->unique('id_interno', 'uq_vehiculo_interno');
            $table->unique('vin', 'uq_vehiculo_vin');
            $table->index('estado_proceso_id', 'ix_veh_estado');
            $table->index('ubicacion_id', 'ix_veh_ubicacion');
            $table->index('estado_comercial', 'ix_veh_comercial');
            $table->index('estado_documental', 'ix_veh_documental');
            $table->index(['marca', 'modelo', 'anio'], 'ix_veh_busqueda');
            $table->index('fecha_compra', 'ix_veh_fcompra');
            $table->foreign('estado_proceso_id', 'fk_veh_estado')->references('id')->on('estado_proceso');
            $table->foreign('ubicacion_id', 'fk_veh_ubicacion')->references('id')->on('ubicacion');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehiculo');
    }
};
