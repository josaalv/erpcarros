<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orden_trabajo', function (Blueprint $table) {
            $table->id();
            $table->string('folio', 20);
            $table->unsignedBigInteger('vehiculo_id');
            $table->enum('tipo', ['interna', 'externa']);
            $table->string('especialidad', 80)->nullable();
            $table->unsignedBigInteger('proveedor_id')->nullable(); // obligatorio si tipo = externa
            $table->unsignedBigInteger('responsable_id')->nullable(); // interno
            $table->text('descripcion');
            $table->enum('prioridad', ['baja', 'normal', 'alta'])->default('normal');
            $table->date('fecha_inicio')->nullable();
            $table->date('fecha_estimada')->nullable();
            $table->date('fecha_real')->nullable();
            $table->enum('estado', [
                'abierta', 'en_proceso', 'espera_piezas', 'terminada', 'cancelada',
            ])->default('abierta');
            $table->unsignedSmallInteger('garantia_dias')->nullable();
            $table->boolean('es_retrabajo')->default(false);
            $table->unsignedBigInteger('ot_origen_id')->nullable(); // si es retrabajo, de cual
            $table->text('observaciones')->nullable();

            SchemaHelpers::bloqueEstandar($table);

            $table->unique('folio', 'uq_ot_folio');
            $table->index('vehiculo_id', 'ix_ot_veh');
            $table->index('estado', 'ix_ot_estado');
            $table->index('proveedor_id', 'ix_ot_prov');
            $table->foreign('vehiculo_id', 'fk_ot_veh')->references('id')->on('vehiculo');
            $table->foreign('proveedor_id', 'fk_ot_prov')->references('id')->on('proveedor');
            $table->foreign('ot_origen_id', 'fk_ot_origen')->references('id')->on('orden_trabajo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orden_trabajo');
    }
};
