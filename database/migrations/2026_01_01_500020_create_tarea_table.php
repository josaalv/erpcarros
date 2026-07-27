<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tarea', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('orden_trabajo_id');
            $table->string('descripcion', 255);
            $table->unsignedBigInteger('asignado_id')->nullable();
            $table->enum('estado', ['pendiente', 'en_proceso', 'terminada'])->default('pendiente');
            $table->unsignedTinyInteger('avance')->default(0);
            $table->text('observaciones')->nullable();

            SchemaHelpers::bloqueEstandar($table);

            $table->index('orden_trabajo_id', 'ix_tarea_ot');
            $table->foreign('orden_trabajo_id', 'fk_tarea_ot')->references('id')->on('orden_trabajo')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tarea');
    }
};
