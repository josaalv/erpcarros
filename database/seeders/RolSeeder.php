<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RolSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('rol')->insertOrIgnore([
            ['clave' => 'admin', 'nombre' => 'Administrador general', 'es_sistema' => true],
            ['clave' => 'gerencia', 'nombre' => 'Gerencia', 'es_sistema' => true],
            ['clave' => 'comisionista', 'nombre' => 'Comisionista', 'es_sistema' => true],
            ['clave' => 'demo', 'nombre' => 'Demostracion', 'es_sistema' => true],
        ]);
    }
}
