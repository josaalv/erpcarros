<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categoria_gasto', function (Blueprint $table) {
            $table->id();
            $table->string('clave', 40);
            $table->string('nombre', 80);
            $table->enum('grupo', [
                'adquisicion', 'logistica', 'taller', 'refacciones',
                'servicios', 'documentacion', 'comercial', 'otros',
            ]);
            $table->boolean('es_interno')->default(false); // trabajo del taller propio
            $table->unsignedSmallInteger('orden')->default(100);
            $table->boolean('activo')->default(true);

            $table->unique('clave', 'uq_categoria_clave');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('categoria_gasto');
    }
};
