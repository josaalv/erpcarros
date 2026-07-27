<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('venta', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('vehiculo_id');
            $table->unsignedBigInteger('cliente_id')->nullable(); // nulo si vendio el lote
            $table->unsignedBigInteger('comisionista_id')->nullable();
            $table->unsignedBigInteger('consignacion_id')->nullable(); // si el canal fue el lote
            $table->enum('canal', ['directa', 'consignacion', 'comisionista', 'anuncio']);
            $table->decimal('precio_acordado', 12, 2);
            $table->enum('forma_pago', [
                'efectivo', 'transferencia', 'financiera', 'toma_a_cuenta', 'mixto',
            ]);
            $table->date('fecha_venta');
            $table->date('fecha_entrega')->nullable();
            $table->string('garantia_texto', 255)->nullable(); // varia por vehiculo
            $table->unsignedSmallInteger('garantia_dias')->nullable();
            $table->unsignedBigInteger('veh_tomado_id')->nullable(); // unidad recibida a cuenta (RN-19)
            $table->decimal('valor_toma', 12, 2)->nullable();
            $table->enum('estado', ['en_proceso', 'completada', 'entregada', 'cancelada'])->default('en_proceso');
            $table->text('observaciones')->nullable();

            SchemaHelpers::bloqueEstandar($table);

            $table->unique('vehiculo_id', 'uq_venta_vehiculo'); // una venta viva por unidad
            $table->index(['canal', 'fecha_venta'], 'ix_venta_canal');
            $table->foreign('vehiculo_id', 'fk_venta_veh')->references('id')->on('vehiculo');
            $table->foreign('cliente_id', 'fk_venta_cli')->references('id')->on('cliente');
            $table->foreign('comisionista_id', 'fk_venta_com')->references('id')->on('comisionista');
            $table->foreign('consignacion_id', 'fk_venta_cons')->references('id')->on('consignacion');
            $table->foreign('veh_tomado_id', 'fk_venta_toma')->references('id')->on('vehiculo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('venta');
    }
};
