<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CategoriaGastoSeeder extends Seeder
{
    /**
     * 24 categorias extraidas del archivo de cuentas real. Ninguna cubre el
     * costo de adquisicion: ese vive solo en 'compra' (ver Codigo 14).
     */
    public function run(): void
    {
        DB::table('categoria_gasto')->insertOrIgnore([
            ['clave' => 'grua', 'nombre' => 'Grua y traslado', 'grupo' => 'logistica', 'es_interno' => false, 'orden' => 40],
            ['clave' => 'almacenaje', 'nombre' => 'Almacenaje', 'grupo' => 'logistica', 'es_interno' => false, 'orden' => 50],
            ['clave' => 'hojalateria', 'nombre' => 'Hojalateria', 'grupo' => 'taller', 'es_interno' => true, 'orden' => 60],
            ['clave' => 'laminado', 'nombre' => 'Laminado', 'grupo' => 'taller', 'es_interno' => true, 'orden' => 70],
            ['clave' => 'pintura', 'nombre' => 'Pintura y materiales', 'grupo' => 'taller', 'es_interno' => true, 'orden' => 80],
            ['clave' => 'pulida', 'nombre' => 'Pulida y detallado', 'grupo' => 'taller', 'es_interno' => true, 'orden' => 90],
            ['clave' => 'destajo', 'nombre' => 'Destajo a personal', 'grupo' => 'taller', 'es_interno' => true, 'orden' => 100],
            ['clave' => 'refacciones', 'nombre' => 'Refacciones y piezas', 'grupo' => 'refacciones', 'es_interno' => false, 'orden' => 110],
            ['clave' => 'llantas', 'nombre' => 'Llantas y rines', 'grupo' => 'refacciones', 'es_interno' => false, 'orden' => 120],
            ['clave' => 'cristales', 'nombre' => 'Cristales', 'grupo' => 'refacciones', 'es_interno' => false, 'orden' => 130],
            ['clave' => 'bateria', 'nombre' => 'Bateria', 'grupo' => 'refacciones', 'es_interno' => false, 'orden' => 140],
            ['clave' => 'mecanica', 'nombre' => 'Servicio mecanico externo', 'grupo' => 'servicios', 'es_interno' => false, 'orden' => 150],
            ['clave' => 'transmision', 'nombre' => 'Transmision', 'grupo' => 'servicios', 'es_interno' => false, 'orden' => 160],
            ['clave' => 'suspension', 'nombre' => 'Suspension y direccion', 'grupo' => 'servicios', 'es_interno' => false, 'orden' => 170],
            ['clave' => 'electrico', 'nombre' => 'Electrico y diagnostico', 'grupo' => 'servicios', 'es_interno' => false, 'orden' => 180],
            ['clave' => 'tapiceria', 'nombre' => 'Tapiceria', 'grupo' => 'servicios', 'es_interno' => false, 'orden' => 190],
            ['clave' => 'placas', 'nombre' => 'Placas y emplacamiento', 'grupo' => 'documentacion', 'es_interno' => false, 'orden' => 200],
            ['clave' => 'gestoria', 'nombre' => 'Tramites y gestoria', 'grupo' => 'documentacion', 'es_interno' => false, 'orden' => 210],
            ['clave' => 'tenencias', 'nombre' => 'Tenencias y adeudos', 'grupo' => 'documentacion', 'es_interno' => false, 'orden' => 220],
            ['clave' => 'kilometraje', 'nombre' => 'Kilometraje', 'grupo' => 'otros', 'es_interno' => false, 'orden' => 230],
            ['clave' => 'gasolina', 'nombre' => 'Gasolina', 'grupo' => 'otros', 'es_interno' => false, 'orden' => 240],
            ['clave' => 'comision_venta', 'nombre' => 'Comision de venta', 'grupo' => 'comercial', 'es_interno' => false, 'orden' => 250],
            ['clave' => 'gasto_lote', 'nombre' => 'Gasto de lote / piso', 'grupo' => 'comercial', 'es_interno' => false, 'orden' => 260],
            ['clave' => 'otros', 'nombre' => 'Otros gastos', 'grupo' => 'otros', 'es_interno' => false, 'orden' => 900],
        ]);
    }
}
