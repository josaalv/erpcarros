<?php

namespace App\Models\Concerns;

use App\Models\Scopes\EsDemoScope;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Auth;

/**
 * Bloque estandar de auditoria, demostracion y borrado logico (Codigo 1 del
 * esquema). Todo modelo sobre una tabla operativa lo usa: SoftDeletes real
 * (deleted_at/deleted_by/delete_motivo), filtro de es_demo, created_by /
 * updated_by automaticos, y bloqueo de escritura para el rol demo (RN-22,
 * CA-14) como segunda capa ademas de las Policies.
 */
trait TieneBloqueEstandar
{
    use SoftDeletes;

    public static function bootTieneBloqueEstandar(): void
    {
        static::addGlobalScope(new EsDemoScope);

        static::creating(function ($model) {
            $usuario = Auth::user();
            static::rechazarEscrituraDemo($usuario);

            if ($usuario) {
                $model->created_by ??= $usuario->id;
                $model->es_demo = $model->es_demo ?? $usuario->esRol('demo');
            }
        });

        static::updating(function ($model) {
            $usuario = Auth::user();
            static::rechazarEscrituraDemo($usuario);

            if ($usuario) {
                $model->updated_by = $usuario->id;
            }
        });

        static::deleting(function ($model) {
            $usuario = Auth::user();
            static::rechazarEscrituraDemo($usuario);

            if ($usuario && ! $model->isForceDeleting()) {
                $model->deleted_by = $usuario->id;
                $model->saveQuietly();
            }
        });
    }

    protected static function rechazarEscrituraDemo(?\App\Models\Usuario $usuario): void
    {
        if ($usuario && $usuario->esRol('demo')) {
            throw new \RuntimeException('El perfil de demostracion no puede escribir (CA-14).');
        }
    }
}
