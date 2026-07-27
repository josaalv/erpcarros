<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('vehiculo_id');
            $table->unsignedBigInteger('orden_trabajo_id')->nullable();
            $table->enum('tipo', ['foto', 'video'])->default('foto');
            $table->enum('etapa', ['subasta', 'recepcion', 'antes', 'durante', 'despues', 'comercial']);
            $table->string('archivo_path', 255);
            $table->boolean('es_publicable')->default(false); // visible a comisionista
            $table->unsignedSmallInteger('orden')->default(0);

            SchemaHelpers::bloqueEstandar($table);

            $table->index(['vehiculo_id', 'etapa', 'orden'], 'ix_media_veh');
            $table->index('es_publicable', 'ix_media_publicable');
            $table->foreign('vehiculo_id', 'fk_media_veh')->references('id')->on('vehiculo');
            $table->foreign('orden_trabajo_id', 'fk_media_ot')->references('id')->on('orden_trabajo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media');
    }
};
