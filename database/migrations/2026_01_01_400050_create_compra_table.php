<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('compra', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('vehiculo_id');
            $table->unsignedBigInteger('subasta_id')->nullable();
            $table->decimal('precio', 12, 2);
            $table->decimal('comision', 12, 2)->default(5000.00); // RN-03
            $table->decimal('impuestos', 12, 2)->default(0);
            $table->decimal('iva', 12, 2)->default(0); // solo refacturada
            $table->enum('forma_pago', ['efectivo', 'transferencia', 'mixto', 'otro'])->nullable();
            $table->date('fecha_estimada_llegada')->nullable();
            $table->unsignedBigInteger('responsable_id')->nullable();
            $table->text('observaciones')->nullable();

            SchemaHelpers::bloqueEstandar($table);

            $table->unique('vehiculo_id', 'uq_compra_vehiculo'); // una compra por unidad
            $table->foreign('vehiculo_id', 'fk_compra_veh')->references('id')->on('vehiculo');
            $table->foreign('subasta_id', 'fk_compra_sub')->references('id')->on('subasta');
            $table->foreign('responsable_id', 'fk_compra_resp')->references('id')->on('usuario');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('compra');
    }
};
