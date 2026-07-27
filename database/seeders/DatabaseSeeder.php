<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Catalogos configurables (Codigo 14 del esquema) mas el usuario
     * administrador inicial. Los datos de negocio reales (12 unidades
     * activas) se capturan a mano, no por seeder (R6).
     */
    public function run(): void
    {
        $this->call([
            RolSeeder::class,
            EstadoProcesoSeeder::class,
            SubestadoTallerSeeder::class,
            UbicacionSeeder::class,
            CategoriaGastoSeeder::class,
            TipoDocumentoSeeder::class,
            UsuarioAdminSeeder::class,
        ]);
    }
}
