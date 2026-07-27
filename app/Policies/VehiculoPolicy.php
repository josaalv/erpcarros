<?php

namespace App\Policies;

use App\Models\Usuario;
use App\Models\Vehiculo;

class VehiculoPolicy
{
    public function viewAny(Usuario $usuario): bool
    {
        return $usuario->puede('vehiculo', 'ver');
    }

    public function view(Usuario $usuario, Vehiculo $vehiculo): bool
    {
        return $this->conAmbito($usuario, 'ver', $vehiculo);
    }

    public function create(Usuario $usuario): bool
    {
        return $usuario->puede('vehiculo', 'crear');
    }

    public function update(Usuario $usuario, Vehiculo $vehiculo): bool
    {
        return $this->conAmbito($usuario, 'editar', $vehiculo);
    }

    public function delete(Usuario $usuario, Vehiculo $vehiculo): bool
    {
        return $this->conAmbito($usuario, 'borrar', $vehiculo);
    }

    /**
     * RN-12: publicar/despublicar es capacidad propia, separada de editar
     * (gerencia puede publicar aunque no capture precio minimo).
     */
    public function publicar(Usuario $usuario, Vehiculo $vehiculo): bool
    {
        return $this->conAmbito($usuario, 'publicar', $vehiculo);
    }

    private function conAmbito(Usuario $usuario, string $accion, Vehiculo $vehiculo): bool
    {
        $ambito = $usuario->ambitoPara('vehiculo', $accion);

        return match ($ambito) {
            'todos' => true,
            'propios' => $vehiculo->created_by === $usuario->id,
            default => false,
        };
    }
}
