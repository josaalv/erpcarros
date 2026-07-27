<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rol_permiso', function (Blueprint $table) {
            $table->unsignedBigInteger('rol_id');
            $table->unsignedBigInteger('permiso_id');
            $table->enum('ambito', ['todos', 'propios', 'ninguno'])->default('ninguno');

            $table->primary(['rol_id', 'permiso_id']);
            $table->foreign('rol_id', 'fk_rp_rol')->references('id')->on('rol')->cascadeOnDelete();
            $table->foreign('permiso_id', 'fk_rp_permiso')->references('id')->on('permiso')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rol_permiso');
    }
};
