<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comisionista', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 120);
            $table->string('telefono', 30)->nullable();
            $table->string('correo', 160)->nullable();
            $table->unsignedBigInteger('usuario_id')->nullable();
            $table->boolean('ver_comisiones')->default(false); // interruptor por persona
            $table->boolean('activo')->default(true);

            SchemaHelpers::bloqueEstandar($table);

            $table->foreign('usuario_id', 'fk_com_usuario')->references('id')->on('usuario');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comisionista');
    }
};
