<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subasta', function (Blueprint $table) {
            $table->id();
            $table->string('plataforma', 60)->default('Prosubastas');
            $table->date('fecha');
            $table->string('lote', 40)->nullable();
            $table->string('num_comprador', 40)->nullable();
            $table->string('patio_origen', 120)->nullable();

            SchemaHelpers::bloqueEstandar($table);

            $table->index('fecha', 'ix_subasta_fecha');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subasta');
    }
};
