<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tipo_documento', function (Blueprint $table) {
            $table->id();
            $table->string('clave', 40);
            $table->string('nombre', 120);
            $table->boolean('obligatorio')->default(false); // bloquea entrega (RN-11)
            $table->boolean('confidencial')->default(true); // nunca visible a comisionista
            $table->unsignedSmallInteger('orden')->default(100);
            $table->boolean('activo')->default(true);

            $table->unique('clave', 'uq_tipodoc_clave');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tipo_documento');
    }
};
