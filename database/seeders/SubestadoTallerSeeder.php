<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SubestadoTallerSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('subestado_taller')->insertOrIgnore([
            ['clave' => 'hojalateria', 'nombre' => 'Hojalateria'],
            ['clave' => 'laminado', 'nombre' => 'Laminado'],
            ['clave' => 'pintura', 'nombre' => 'Pintura'],
            ['clave' => 'servicio_externo', 'nombre' => 'Servicio externo'],
            ['clave' => 'espera_piezas', 'nombre' => 'Espera de piezas'],
            ['clave' => 'retrabajo', 'nombre' => 'Retrabajo'],
        ]);
    }
}
