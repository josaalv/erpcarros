<?php

namespace Tests\Feature;

use App\Models\Comisionista;
use App\Models\CategoriaGasto;
use App\Models\EstadoProceso;
use App\Models\Gasto;
use App\Models\Prospecto;
use App\Models\Rol;
use App\Models\Ubicacion;
use App\Models\Usuario;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pruebas de permisos (§17 del analisis): "se prueban en negativo, contra
 * el servidor y sin pasar por la interfaz... se automatizan: son las que
 * no pueden romperse nunca". No verifican la UI, verifican que el Gate /
 * las Policies nieguen explicitamente lo que la matriz de acceso (Tabla 2)
 * dice que ese rol no puede hacer.
 */
class AutorizacionPermisosTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function usuarioConRol(string $claveRol): Usuario
    {
        $rol = Rol::where('clave', $claveRol)->firstOrFail();

        return Usuario::create([
            'nombre' => 'Usuario '.$claveRol,
            'correo' => $claveRol.'-'.uniqid().'@test.local',
            'password_hash' => bcrypt('secreto'),
            'rol_id' => $rol->id,
            'activo' => true,
        ]);
    }

    private function vehiculoDePrueba(): Vehiculo
    {
        return Vehiculo::create([
            'id_interno' => 'V-'.uniqid(),
            'marca' => 'Test', 'modelo' => 'Demo', 'anio' => 2024,
            'estado_proceso_id' => EstadoProceso::where('clave', 'listo')->firstOrFail()->id,
            'ubicacion_id' => Ubicacion::where('clave', 'taller')->firstOrFail()->id,
        ]);
    }

    public function test_gerencia_no_puede_ver_gastos_e_importes(): void
    {
        $admin = $this->usuarioConRol('admin');
        $this->actingAs($admin);
        $vehiculo = $this->vehiculoDePrueba();
        $gasto = Gasto::create([
            'vehiculo_id' => $vehiculo->id,
            'categoria_id' => CategoriaGasto::where('clave', 'otros')->firstOrFail()->id,
            'descripcion' => 'Gasto confidencial', 'importe' => 5000, 'fecha' => now(),
        ]);

        $gerencia = $this->usuarioConRol('gerencia');

        $this->assertFalse($gerencia->can('viewAny', Gasto::class));
        $this->assertFalse($gerencia->can('view', $gasto));
        $this->assertFalse($gerencia->can('create', Gasto::class));
    }

    public function test_comisionista_no_ve_precio_minimo_ni_cifras_financieras(): void
    {
        $comisionista = $this->usuarioConRol('comisionista');

        $this->assertFalse($comisionista->vePrecioMinimo());
        $this->assertFalse($comisionista->veCifrasFinancieras());
        $this->assertFalse($comisionista->puede('gasto', 'ver'));
    }

    public function test_comisionista_no_puede_ver_prospectos_ajenos(): void
    {
        $usuarioA = $this->usuarioConRol('comisionista');
        $comisionistaA = Comisionista::create(['nombre' => 'A', 'usuario_id' => $usuarioA->id]);

        $usuarioB = $this->usuarioConRol('comisionista');
        $comisionistaB = Comisionista::create(['nombre' => 'B', 'usuario_id' => $usuarioB->id]);

        $this->actingAs($usuarioA);
        $cliente = \App\Models\Cliente::create(['nombre' => 'Cliente de prueba']);
        $prospectoDeB = Prospecto::create([
            'cliente_id' => $cliente->id,
            'comisionista_id' => $comisionistaB->id,
            'fecha_registro' => now(),
        ]);

        $usuarioA->refresh();
        $this->assertFalse($usuarioA->can('view', $prospectoDeB));
        $this->assertFalse($usuarioA->can('update', $prospectoDeB));
    }

    public function test_perfil_demo_no_puede_escribir_nada(): void
    {
        $demo = $this->usuarioConRol('demo');
        $this->actingAs($demo);

        $this->expectException(\RuntimeException::class);
        $this->vehiculoDePrueba();
    }

    public function test_usuario_desactivado_pierde_todo_permiso(): void
    {
        $gerencia = $this->usuarioConRol('gerencia');
        $gerencia->activo = false;
        $gerencia->save();

        $this->assertFalse($gerencia->puede('vehiculo', 'ver'));
        $this->assertSame('ninguno', $gerencia->ambitoPara('vehiculo', 'editar'));
    }

    public function test_admin_tiene_acceso_total_sin_filas_en_rol_permiso(): void
    {
        $admin = $this->usuarioConRol('admin');

        $this->assertTrue($admin->puede('cierre_financiero', 'editar'));
        $this->assertTrue($admin->vePrecioMinimo());
        $this->assertTrue($admin->veCifrasFinancieras());
    }
}
