<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('proveedor', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 120);
            $table->string('empresa', 120)->nullable();
            $table->string('especialidad', 80)->nullable(); // mecanica, transmision, cristales, gestoria
            $table->string('telefono', 30)->nullable();
            $table->string('correo', 160)->nullable();
            $table->string('direccion', 255)->nullable();
            $table->boolean('es_gestor')->default(false); // hace tramites
            $table->unsignedTinyInteger('calificacion')->nullable(); // 1..5, fase 2
            $table->text('notas')->nullable();
            $table->boolean('activo')->default(true);

            SchemaHelpers::bloqueEstandar($table);

            $table->index('especialidad', 'ix_prov_especialidad');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proveedor');
    }
};
