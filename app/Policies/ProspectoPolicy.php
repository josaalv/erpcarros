<?php

namespace App\Policies;

use App\Models\Prospecto;
use App\Models\Usuario;

/**
 * RN-13/RN-16: el comisionista solo ve/edita los prospectos que el mismo
 * registro (via comisionista_id), nunca los de otro comisionista (CA-06).
 */
class ProspectoPolicy
{
    public function viewAny(Usuario $usuario): bool
    {
        return $usuario->puede('prospecto', 'ver');
    }

    public function view(Usuario $usuario, Prospecto $prospecto): bool
    {
        return $this->conAmbito($usuario, 'ver', $prospecto);
    }

    public function create(Usuario $usuario): bool
    {
        return $usuario->puede('prospecto', 'crear');
    }

    public function update(Usuario $usuario, Prospecto $prospecto): bool
    {
        return $this->conAmbito($usuario, 'editar', $prospecto);
    }

    private function conAmbito(Usuario $usuario, string $accion, Prospecto $prospecto): bool
    {
        $ambito = $usuario->ambitoPara('prospecto', $accion);

        return match ($ambito) {
            'todos' => true,
            'propios' => $usuario->comisionista?->id === $prospecto->comisionista_id,
            default => false,
        };
    }
}
