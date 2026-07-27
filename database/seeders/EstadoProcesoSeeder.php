<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class EstadoProcesoSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('estado_proceso')->insertOrIgnore([
            ['clave' => 'evaluacion', 'nombre' => 'Evaluacion en subasta', 'orden' => 10, 'es_final' => false],
            ['clave' => 'comprado', 'nombre' => 'Comprado', 'orden' => 20, 'es_final' => false],
            ['clave' => 'traslado', 'nombre' => 'En traslado', 'orden' => 30, 'es_final' => false],
            ['clave' => 'diagnostico', 'nombre' => 'Diagnostico', 'orden' => 40, 'es_final' => false],
            ['clave' => 'reparacion', 'nombre' => 'En reparacion', 'orden' => 50, 'es_final' => false],
            ['clave' => 'preparacion', 'nombre' => 'En preparacion', 'orden' => 60, 'es_final' => false],
            ['clave' => 'listo', 'nombre' => 'Listo para venta', 'orden' => 70, 'es_final' => false],
            ['clave' => 'apartado', 'nombre' => 'Apartado', 'orden' => 80, 'es_final' => false],
            ['clave' => 'vendido', 'nombre' => 'Vendido / entregado', 'orden' => 90, 'es_final' => false],
            ['clave' => 'cerrado', 'nombre' => 'Operacion cerrada', 'orden' => 100, 'es_final' => true],
            ['clave' => 'cancelado', 'nombre' => 'Cancelado', 'orden' => 110, 'es_final' => true],
        ]);
    }
}
