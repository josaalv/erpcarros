<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('intento_acceso', function (Blueprint $table) {
            $table->id();
            $table->string('correo', 160);
            $table->boolean('exito');
            $table->binary('ip')->nullable();
            $table->string('agente', 255)->nullable();
            $table->dateTime('ocurrido')->useCurrent();

            $table->index(['correo', 'ocurrido'], 'ix_intento');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('intento_acceso');
    }
};
