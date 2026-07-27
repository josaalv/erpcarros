<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('auditoria', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('usuario_id')->nullable();
            $table->string('accion', 40); // crear | editar | borrar | ver | descargar
            $table->string('entidad', 60);
            $table->unsignedBigInteger('entidad_id')->nullable();
            $table->json('valores_anteriores')->nullable();
            $table->json('valores_nuevos')->nullable();
            $table->binary('ip')->nullable();
            $table->dateTime('ocurrido')->useCurrent();

            $table->index(['entidad', 'entidad_id', 'ocurrido'], 'ix_aud_entidad');
            $table->index(['usuario_id', 'ocurrido'], 'ix_aud_usuario');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('auditoria');
    }
};
