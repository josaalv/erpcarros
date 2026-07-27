<?php

namespace App\Support;

use Illuminate\Database\Schema\Blueprint;

/**
 * Bloque estándar de auditoría, demostración y borrado lógico (Código 1 del
 * esquema de base de datos). Toda tabla operativa lo incluye.
 */
class SchemaHelpers
{
    public static function bloqueEstandar(Blueprint $table): void
    {
        $table->boolean('es_demo')->default(false);
        $table->dateTime('created_at')->useCurrent();
        $table->unsignedBigInteger('created_by')->nullable();
        $table->dateTime('updated_at')->useCurrent()->useCurrentOnUpdate();
        $table->unsignedBigInteger('updated_by')->nullable();
        $table->dateTime('deleted_at')->nullable();
        $table->unsignedBigInteger('deleted_by')->nullable();
        $table->string('delete_motivo', 255)->nullable();

        $table->index('es_demo', 'ix_' . $table->getTable() . '_demo');
        $table->index('deleted_at', 'ix_' . $table->getTable() . '_borrado');
    }
}
