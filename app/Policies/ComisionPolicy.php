<?php

namespace App\Policies;

use App\Models\Comision;
use App\Models\Usuario;

/**
 * Tabla 2: "Autorizar comision y pagarla" — el comisionista solo ve la
 * propia (si ver_comisiones esta habilitado para el, ver Comisionista
 * .ver_comisiones), nunca autoriza ni ve las de otros.
 */
class ComisionPolicy
{
    public function viewAny(Usuario $usuario): bool
    {
        return $usuario->puede('comision', 'ver');
    }

    public function view(Usuario $usuario, Comision $comision): bool
    {
        $ambito = $usuario->ambitoPara('comision', 'ver');

        return match ($ambito) {
            'todos' => true,
            'propios' => $usuario->comisionista?->id === $comision->comisionista_id
                && $usuario->comisionista?->ver_comisiones,
            default => false,
        };
    }

    public function autorizar(Usuario $usuario): bool
    {
        return $usuario->puede('comision', 'autorizar');
    }
}
