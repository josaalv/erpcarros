<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('diagnostico', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('vehiculo_id');
            $table->date('fecha');
            $table->unsignedBigInteger('responsable_id')->nullable();
            $table->text('hallazgos')->nullable();
            $table->decimal('presupuesto_estimado', 12, 2)->nullable(); // SOLO ROL ADMIN

            SchemaHelpers::bloqueEstandar($table);

            $table->index('vehiculo_id', 'ix_diag_veh');
            $table->foreign('vehiculo_id', 'fk_diag_veh')->references('id')->on('vehiculo');
            $table->foreign('responsable_id', 'fk_diag_resp')->references('id')->on('usuario');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('diagnostico');
    }
};
