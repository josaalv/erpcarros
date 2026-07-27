<?php

namespace Tests\Feature;

use App\Models\CategoriaGasto;
use App\Models\Compra;
use App\Models\EstadoProceso;
use App\Models\Gasto;
use App\Models\Ubicacion;
use App\Models\Usuario;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * §17 del analisis: "se validan reproduciendo tres unidades reales ya
 * cerradas de tu archivo y comparando contra el resultado conocido. Si el
 * sistema no reproduce estos numeros, esta mal." Automatiza el caso
 * Mirage 2022 ya verificado a mano (ver docs/DEPLOY.md).
 */
class CalculoFinancieroTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_costo_total_mirage_2022_reproduce_al_peso(): void
    {
        $admin = Usuario::whereHas('rol', fn ($q) => $q->where('clave', 'admin'))->firstOrFail();
        $this->actingAs($admin);

        $vehiculo = Vehiculo::create([
            'id_interno' => 'V-0142', 'marca' => 'Mitsubishi', 'modelo' => 'Mirage', 'anio' => 2022,
            'estado_proceso_id' => EstadoProceso::where('clave', 'listo')->firstOrFail()->id,
            'ubicacion_id' => Ubicacion::where('clave', 'taller')->firstOrFail()->id,
            'fecha_compra' => '2026-06-02',
            'precio_autorizado' => 180000.00,
        ]);

        Compra::create(['vehiculo_id' => $vehiculo->id, 'precio' => 95000.00, 'comision' => 5000.00]);

        $gastos = [
            ['pintura', 10000.00], ['laminado', 3000.00], ['llantas', 6500.00],
            ['electrico', 2500.00], ['placas', 6500.00], ['refacciones', 2100.00],
            ['refacciones', 1500.00], ['pulida', 2000.00], ['refacciones', 1500.00],
            ['bateria', 1400.00], ['otros', 5580.00],
        ];
        foreach ($gastos as [$clave, $importe]) {
            Gasto::create([
                'vehiculo_id' => $vehiculo->id,
                'categoria_id' => CategoriaGasto::where('clave', $clave)->firstOrFail()->id,
                'descripcion' => "Gasto $clave", 'importe' => $importe, 'fecha' => '2026-06-15',
            ]);
        }

        $costo = $vehiculo->costo; // v_costo_vehiculo
        $this->assertSame('142580.00', $costo->costo_total);

        $utilidad = bcsub('180000.00', $costo->costo_total, 2);
        $margen = round((float) bcdiv($utilidad, '180000.00', 6), 4);

        $this->assertSame('37420.00', $utilidad);
        $this->assertSame(0.2079, $margen);
    }
}
