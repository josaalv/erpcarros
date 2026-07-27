<?php

use App\Support\SchemaHelpers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('usuario', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 120);
            $table->string('correo', 160);
            $table->string('password_hash', 255); // bcrypt / argon2, nunca texto plano
            $table->unsignedBigInteger('rol_id');
            $table->string('telefono', 30)->nullable();
            $table->boolean('activo')->default(true);
            $table->binary('mfa_secreto')->nullable(); // cifrado en aplicacion, solo admin
            $table->dateTime('ultimo_acceso')->nullable();

            SchemaHelpers::bloqueEstandar($table);

            $table->unique('correo', 'uq_usuario_correo');
            $table->index('rol_id', 'ix_usuario_rol');
            $table->foreign('rol_id', 'fk_usuario_rol')->references('id')->on('rol');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('usuario');
    }
};
