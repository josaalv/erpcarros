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
        Schema::create('consignacion', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('vehiculo_id');
            $table->unsignedBigInteger('lote_id');
            $table->decimal('precio_asignado', 12, 2); // lo que el lote te paga (RN-28)
            $table->date('fecha_envio');
            $table->date('fecha_retiro')->nullable();
            $table->enum('estado', ['en_consignacion', 'retirada', 'vendida_por_lote', 'conciliada'])
                ->default('en_consignacion');
            $table->date('fecha_venta_reportada')->nullable();
            $table->date('fecha_pago_recibido')->nullable();
            $table->string('evidencia_entrega_path', 255)->nullable();
            $table->string('evidencia_pago_path', 255)->nullable();
            $table->text('observaciones')->nullable();

            SchemaHelpers::bloqueEstandar($table);

            $table->index('vehiculo_id', 'ix_cons_veh');
            $table->index('estado', 'ix_cons_estado');
            $table->foreign('vehiculo_id', 'fk_cons_veh')->references('id')->on('vehiculo');
            $table->foreign('lote_id', 'fk_cons_lote')->references('id')->on('lote');
        });

        DB::statement('ALTER TABLE consignacion ADD CONSTRAINT ck_cons_precio CHECK (precio_asignado > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('consignacion');
    }
};
