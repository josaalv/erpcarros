<?php

namespace App\Policies;

use App\Models\Gasto;
use App\Models\Usuario;

/**
 * Tabla 2: "Registro de gasto e importes" es Total para admin y nada para
 * los demas roles reales (gerencia/comisionista). Demo ve importes
 * ficticios (000000) via Usuario::veCifrasFinancieras(), nunca escribe.
 */
class GastoPolicy
{
    public function viewAny(Usuario $usuario): bool
    {
        return $usuario->puede('gasto', 'ver');
    }

    public function view(Usuario $usuario, Gasto $gasto): bool
    {
        return $this->conAmbito($usuario, 'ver', $gasto);
    }

    public function create(Usuario $usuario): bool
    {
        return $usuario->puede('gasto', 'crear');
    }

    public function update(Usuario $usuario, Gasto $gasto): bool
    {
        return $this->conAmbito($usuario, 'editar', $gasto);
    }

    public function delete(Usuario $usuario, Gasto $gasto): bool
    {
        return $this->conAmbito($usuario, 'borrar', $gasto);
    }

    private function conAmbito(Usuario $usuario, string $accion, Gasto $gasto): bool
    {
        $ambito = $usuario->ambitoPara('gasto', $accion);

        return match ($ambito) {
            'todos' => true,
            'propios' => $gasto->created_by === $usuario->id,
            default => false,
        };
    }
}
