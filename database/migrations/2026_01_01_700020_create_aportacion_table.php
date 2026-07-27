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
        // Cuando un socio paga un gasto se generan DOS registros: el gasto
        // (costo de la unidad) y esta aportacion (capital que metio ese
        // socio). Se crean siempre juntos en una sola transaccion.
        Schema::create('aportacion', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('vehiculo_id');
            $table->unsignedBigInteger('socio_id');
            $table->enum('concepto', ['compra', 'gasto', 'abono']);
            $table->unsignedBigInteger('gasto_id')->nullable(); // si nace de un gasto pagado por el socio
            $table->decimal('monto', 12, 2);
            $table->date('fecha');
            $table->string('comprobante_path', 255)->nullable();

            SchemaHelpers::bloqueEstandar($table);

            $table->index('vehiculo_id', 'ix_aport_veh');
            $table->index('socio_id', 'ix_aport_socio');
            $table->foreign('vehiculo_id', 'fk_aport_veh')->references('id')->on('vehiculo');
            $table->foreign('socio_id', 'fk_aport_socio')->references('id')->on('socio');
            $table->foreign('gasto_id', 'fk_aport_gasto')->references('id')->on('gasto');
        });

        DB::statement('ALTER TABLE aportacion ADD CONSTRAINT ck_aport_monto CHECK (monto > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('aportacion');
    }
};
