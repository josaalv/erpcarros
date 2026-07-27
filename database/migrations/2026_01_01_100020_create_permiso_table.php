<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('permiso', function (Blueprint $table) {
            $table->id();
            $table->string('recurso', 60); // vehiculo | gasto | cierre | prospecto ...
            $table->string('accion', 30); // ver | crear | editar | borrar | autorizar
            $table->enum('ambito', ['todos', 'propios', 'ninguno'])->default('ninguno');

            $table->unique(['recurso', 'accion'], 'uq_permiso');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('permiso');
    }
};
