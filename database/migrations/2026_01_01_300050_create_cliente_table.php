<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cliente', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 120);
            $table->string('telefono', 30)->nullable();
            $table->string('correo', 160)->nullable();
            $table->enum('origen', ['referido', 'lote', 'anuncio', 'directo', 'otro'])->default('directo');
            $table->text('notas')->nullable();

            SchemaHelpers::bloqueEstandar($table);

            // Base del antiduplicado (RN-15). MySQL permite varios NULL en UNIQUE:
            // el telefono debe quedar NULL y nunca cadena vacia.
            $table->unique('telefono', 'uq_cliente_telefono');
            $table->index('nombre', 'ix_cliente_nombre');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cliente');
    }
};
