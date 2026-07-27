<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rol', function (Blueprint $table) {
            $table->id();
            $table->string('clave', 40); // admin | gerencia | comisionista | demo
            $table->string('nombre', 80);
            $table->string('descripcion', 255)->nullable();
            $table->boolean('es_sistema')->default(true); // los de sistema no se borran

            $table->unique('clave', 'uq_rol_clave');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rol');
    }
};
