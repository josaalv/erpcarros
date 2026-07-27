<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // La unica tabla que guarda totales calculados: aqui es correcto,
        // porque el punto es congelarlos (RN-20, RN-21).
        Schema::create('cierre_financiero', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('vehiculo_id');
            $table->unsignedBigInteger('venta_id')->nullable();
            $table->decimal('costo_total', 12, 2); // congelado
            $table->decimal('precio_final', 12, 2);
            $table->decimal('utilidad_bruta', 12, 2);
            $table->decimal('utilidad_neta', 12, 2);
            $table->decimal('margen', 7, 4);
            $table->decimal('roi', 7, 4);
            $table->unsignedSmallInteger('dias_inventario');
            $table->decimal('costo_por_dia', 12, 2);
            $table->enum('canal_venta', ['directa', 'consignacion', 'comisionista', 'anuncio']);
            $table->enum('estado', ['cerrado', 'reabierto'])->default('cerrado');
            $table->unsignedBigInteger('cerrado_por');
            $table->dateTime('fecha_cierre')->useCurrent();

            SchemaHelpers::bloqueEstandar($table);

            $table->unique('vehiculo_id', 'uq_cierre_vehiculo');
            $table->index(['canal_venta', 'fecha_cierre'], 'ix_cierre_canal');
            $table->foreign('vehiculo_id', 'fk_cierre_veh')->references('id')->on('vehiculo');
            $table->foreign('venta_id', 'fk_cierre_venta')->references('id')->on('venta');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cierre_financiero');
    }
};
