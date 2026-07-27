<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interaccion', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('prospecto_id');
            $table->enum('tipo', ['llamada', 'mensaje', 'visita', 'prueba_manejo', 'otro']);
            $table->dateTime('ocurrido')->useCurrent();
            $table->string('resultado', 255)->nullable();
            $table->text('nota')->nullable();

            SchemaHelpers::bloqueEstandar($table);

            $table->index(['prospecto_id', 'ocurrido'], 'ix_inter_prosp');
            $table->foreign('prospecto_id', 'fk_inter_prosp')->references('id')->on('prospecto')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interaccion');
    }
};
