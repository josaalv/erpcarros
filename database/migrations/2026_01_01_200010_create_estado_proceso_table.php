<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('estado_proceso', function (Blueprint $table) {
            $table->id();
            $table->string('clave', 40);
            $table->string('nombre', 80);
            $table->unsignedSmallInteger('orden');
            $table->boolean('es_final')->default(false); // cerrado, cancelado
            $table->boolean('activo')->default(true);

            $table->unique('clave', 'uq_estado_clave');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('estado_proceso');
    }
};
