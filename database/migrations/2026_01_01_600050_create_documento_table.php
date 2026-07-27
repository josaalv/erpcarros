<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documento', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('vehiculo_id');
            $table->unsignedBigInteger('tipo_documento_id');
            $table->string('archivo_path', 255)->nullable(); // fuera de la carpeta publica
            $table->string('archivo_nombre', 160)->nullable();
            $table->unsignedInteger('archivo_bytes')->nullable();
            $table->enum('estado', ['faltante', 'en_tramite', 'completo'])->default('faltante');
            $table->date('fecha_obtencion')->nullable();
            $table->string('observaciones', 255)->nullable();

            SchemaHelpers::bloqueEstandar($table);

            $table->unique(['vehiculo_id', 'tipo_documento_id'], 'uq_doc_veh_tipo');
            $table->index('estado', 'ix_doc_estado');
            $table->foreign('vehiculo_id', 'fk_doc_veh')->references('id')->on('vehiculo');
            $table->foreign('tipo_documento_id', 'fk_doc_tipo')->references('id')->on('tipo_documento');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documento');
    }
};
