<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class UbicacionSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('ubicacion')->insertOrIgnore([
            ['clave' => 'subasta', 'nombre' => 'Patio de subasta', 'es_externa' => true],
            ['clave' => 'traslado', 'nombre' => 'En traslado', 'es_externa' => true],
            ['clave' => 'taller', 'nombre' => 'Taller propio', 'es_externa' => false],
            ['clave' => 'exhibicion_taller', 'nombre' => 'Exhibicion afuera del taller', 'es_externa' => false],
            ['clave' => 'lote_consignacion', 'nombre' => 'Lote a consignacion', 'es_externa' => true],
            ['clave' => 'proveedor', 'nombre' => 'Proveedor externo', 'es_externa' => true],
            ['clave' => 'con_cliente', 'nombre' => 'Con cliente, prueba autorizada', 'es_externa' => true],
            ['clave' => 'entregado', 'nombre' => 'Entregado', 'es_externa' => true],
            ['clave' => 'temporal', 'nombre' => 'Otra ubicacion temporal', 'es_externa' => true],
        ]);
    }
}
