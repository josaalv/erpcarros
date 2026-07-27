<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notificacion', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('usuario_id');
            $table->string('tipo', 60);
            $table->string('mensaje', 255);
            $table->string('entidad', 60)->nullable();
            $table->unsignedBigInteger('entidad_id')->nullable();
            $table->boolean('leida')->default(false);
            $table->dateTime('creada')->useCurrent();

            $table->index(['usuario_id', 'leida', 'creada'], 'ix_notif_usuario');
            $table->foreign('usuario_id', 'fk_notif_usuario')->references('id')->on('usuario');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notificacion');
    }
};
