<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subestado_taller', function (Blueprint $table) {
            $table->id();
            $table->string('clave', 40);
            $table->string('nombre', 80);
            $table->boolean('activo')->default(true);

            $table->unique('clave', 'uq_subestado_clave');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subestado_taller');
    }
};
