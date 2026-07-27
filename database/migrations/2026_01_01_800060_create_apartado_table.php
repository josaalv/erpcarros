<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('apartado', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('vehiculo_id');
            $table->unsignedBigInteger('cliente_id');
            $table->unsignedBigInteger('comisionista_id')->nullable();
            $table->decimal('monto', 12, 2);
            $table->date('fecha');
            $table->date('vence'); // 30 dias (RN-17)
            $table->enum('estado', ['activo', 'aplicado', 'vencido', 'cancelado'])->default('activo');
            $table->boolean('reembolsable')->default(false);
            $table->string('motivo_cancelacion', 255)->nullable();

            SchemaHelpers::bloqueEstandar($table);

            $table->index('vehiculo_id', 'ix_apartado_veh');
            $table->index(['vence', 'estado'], 'ix_apartado_vence');
            $table->foreign('vehiculo_id', 'fk_apart_veh')->references('id')->on('vehiculo');
            $table->foreign('cliente_id', 'fk_apart_client')->references('id')->on('cliente');
            $table->foreign('comisionista_id', 'fk_apart_com')->references('id')->on('comisionista');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('apartado');
    }
};
