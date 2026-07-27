<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liquidacion', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cierre_id');
            $table->unsignedBigInteger('vehiculo_id');
            $table->unsignedBigInteger('socio_id');
            $table->decimal('capital_aportado', 12, 2);
            $table->decimal('participacion', 7, 4); // fraccion, suma 1.0000
            $table->decimal('utilidad_asignada', 12, 2);
            $table->decimal('monto_a_pagar', 12, 2);
            $table->boolean('pagado')->default(false);
            $table->date('fecha_pago')->nullable();
            $table->string('comprobante_path', 255)->nullable();

            SchemaHelpers::bloqueEstandar($table);

            $table->unique(['cierre_id', 'socio_id'], 'uq_liq');
            $table->foreign('cierre_id', 'fk_liq_cierre')->references('id')->on('cierre_financiero');
            $table->foreign('vehiculo_id', 'fk_liq_veh')->references('id')->on('vehiculo');
            $table->foreign('socio_id', 'fk_liq_socio')->references('id')->on('socio');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liquidacion');
    }
};
