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
        Schema::create('pago', function (Blueprint $table) {
            $table->id();
            $table->enum('tipo', ['a_proveedor', 'de_cliente', 'a_socio', 'a_comisionista']);
            $table->unsignedBigInteger('vehiculo_id')->nullable();
            $table->unsignedBigInteger('proveedor_id')->nullable();
            $table->unsignedBigInteger('socio_id')->nullable();
            $table->unsignedBigInteger('comisionista_id')->nullable();
            $table->unsignedBigInteger('venta_id')->nullable();
            $table->decimal('importe', 12, 2);
            $table->date('fecha');
            $table->enum('metodo', ['efectivo', 'transferencia', 'otro'])->default('transferencia');
            $table->string('referencia', 80)->nullable();
            $table->string('comprobante_path', 255)->nullable();

            SchemaHelpers::bloqueEstandar($table);

            $table->index(['tipo', 'fecha'], 'ix_pago_tipo');
            $table->index('vehiculo_id', 'ix_pago_veh');
            $table->foreign('vehiculo_id', 'fk_pago_veh')->references('id')->on('vehiculo');
            $table->foreign('proveedor_id', 'fk_pago_prov')->references('id')->on('proveedor');
            $table->foreign('socio_id', 'fk_pago_socio')->references('id')->on('socio');
            $table->foreign('comisionista_id', 'fk_pago_com')->references('id')->on('comisionista');
            $table->foreign('venta_id', 'fk_pago_venta')->references('id')->on('venta');
        });

        DB::statement('ALTER TABLE pago ADD CONSTRAINT ck_pago_importe CHECK (importe > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('pago');
    }
};
