<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TipoDocumentoSeeder extends Seeder
{
    /**
     * Los seis primeros son obligatorios y bloquean la entrega (RN-11).
     */
    public function run(): void
    {
        DB::table('tipo_documento')->insertOrIgnore([
            ['clave' => 'factura', 'nombre' => 'Factura original', 'obligatorio' => true, 'confidencial' => true, 'orden' => 10],
            ['clave' => 'endosos', 'nombre' => 'Endoso o cadena de facturas', 'obligatorio' => true, 'confidencial' => true, 'orden' => 20],
            ['clave' => 'tarjeta', 'nombre' => 'Tarjeta de circulacion', 'obligatorio' => true, 'confidencial' => true, 'orden' => 30],
            ['clave' => 'tenencias', 'nombre' => 'Tenencias y refrendos pagados', 'obligatorio' => true, 'confidencial' => true, 'orden' => 40],
            ['clave' => 'placas', 'nombre' => 'Alta y placas nuevas', 'obligatorio' => true, 'confidencial' => true, 'orden' => 50],
            ['clave' => 'contrato', 'nombre' => 'Contrato de compraventa', 'obligatorio' => true, 'confidencial' => true, 'orden' => 60],
            ['clave' => 'reporte_subasta', 'nombre' => 'Reporte de subasta', 'obligatorio' => false, 'confidencial' => true, 'orden' => 70],
            ['clave' => 'comprobante_pago', 'nombre' => 'Comprobante de pago', 'obligatorio' => false, 'confidencial' => true, 'orden' => 80],
            ['clave' => 'verificacion', 'nombre' => 'Verificacion vehicular', 'obligatorio' => false, 'confidencial' => true, 'orden' => 90],
            ['clave' => 'otros', 'nombre' => 'Otro documento', 'obligatorio' => false, 'confidencial' => true, 'orden' => 900],
        ]);
    }
}
