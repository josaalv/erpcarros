<?php

namespace Database\Seeders;

use App\Models\Rol;
use App\Models\Usuario;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UsuarioAdminSeeder extends Seeder
{
    /**
     * Usuario administrador inicial para poder entrar al panel. Cambia la
     * contraseña de inmediato tras el primer acceso.
     */
    public function run(): void
    {
        $rolAdmin = Rol::where('clave', 'admin')->first();

        if (! $rolAdmin) {
            return;
        }

        Usuario::firstOrCreate(
            ['correo' => 'admin@erpcarros.test'],
            [
                'nombre' => 'Administrador',
                'password_hash' => Hash::make('cambia-esta-contrasena'),
                'rol_id' => $rolAdmin->id,
                'activo' => true,
            ]
        );
    }
}
