<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lote', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 120);
            $table->string('contacto', 120)->nullable();
            $table->string('telefono', 30)->nullable();
            $table->string('direccion', 255)->nullable();
            $table->text('notas')->nullable();
            $table->boolean('activo')->default(true);

            SchemaHelpers::bloqueEstandar($table);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lote');
    }
};
