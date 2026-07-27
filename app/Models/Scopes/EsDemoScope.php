<?php

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Facades\Auth;

/**
 * Un registro real y uno de demostracion nunca se mezclan en una consulta.
 * El rol 'demo' solo ve es_demo=1; cualquier otro rol solo ve es_demo=0.
 * Sin usuario autenticado (comandos, seeders) no se filtra.
 */
class EsDemoScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $usuario = Auth::user();

        if (! $usuario) {
            return;
        }

        $builder->where(
            $model->qualifyColumn('es_demo'),
            $usuario->esRol('demo')
        );
    }
}
