<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dano', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('vehiculo_id');
            $table->string('zona', 60); // cofre, salpicadera izq, interior...
            $table->string('tipo', 60)->nullable(); // golpe, rayon, faltante, mecanico
            $table->enum('severidad', ['leve', 'medio', 'grave'])->default('medio');
            $table->enum('detectado_en', ['subasta', 'recepcion', 'diagnostico', 'posterior']);
            $table->text('descripcion')->nullable();
            $table->boolean('resuelto')->default(false);

            SchemaHelpers::bloqueEstandar($table);

            $table->index('vehiculo_id', 'ix_dano_veh');
            $table->foreign('vehiculo_id', 'fk_dano_veh')->references('id')->on('vehiculo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dano');
    }
};
