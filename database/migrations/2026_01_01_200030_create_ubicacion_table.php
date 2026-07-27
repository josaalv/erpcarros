<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ubicacion', function (Blueprint $table) {
            $table->id();
            $table->string('clave', 40);
            $table->string('nombre', 80);
            $table->boolean('es_externa')->default(false); // fuera de tu control fisico
            $table->boolean('activo')->default(true);

            $table->unique('clave', 'uq_ubicacion_clave');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ubicacion');
    }
};
