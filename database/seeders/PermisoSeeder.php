<?php

namespace Database\Seeders;

use App\Models\Permiso;
use App\Models\Rol;
use Illuminate\Database\Seeder;

/**
 * Traduce la Tabla 2 (matriz de acceso) de
 * docs/analisis-fuente/03-analisis-reglas-permisos.txt §6 a filas
 * concretas de recurso/accion/ambito. 'ambito' aqui es alcance de FILAS
 * (todos | propios | ninguno) — NO decide que campos financieros se ven;
 * eso (precio_minimo, costo, utilidad, margen) se redacta aparte en la
 * capa de presentacion (ver App\Models\Concerns\OcultaCamposFinancieros),
 * tal como exige el analisis: "los campos financieros no se consultan
 * cuando el rol no los permite".
 *
 * El rol 'admin' NO tiene filas aqui a proposito: Usuario::ambitoPara()
 * responde 'todos' para admin sin consultar esta tabla (bypass explicito,
 * ver el helper). Lo que SI falta sembrar aqui son los ambitos reales de
 * gerencia/comisionista/demo.
 */
class PermisoSeeder extends Seeder
{
    /**
     * @var array<int, array{0: string, 1: string}>
     */
    private const RECURSO_ACCION = [
        ['usuario', 'ver'], ['usuario', 'crear'], ['usuario', 'editar'], ['usuario', 'borrar'],
        ['vehiculo', 'ver'], ['vehiculo', 'crear'], ['vehiculo', 'editar'], ['vehiculo', 'borrar'], ['vehiculo', 'publicar'],
        ['compra', 'ver'], ['compra', 'crear'], ['compra', 'editar'],
        ['evaluacion_puja', 'ver'], ['evaluacion_puja', 'crear'], ['evaluacion_puja', 'editar'],
        ['gasto', 'ver'], ['gasto', 'crear'], ['gasto', 'editar'], ['gasto', 'borrar'],
        ['orden_trabajo', 'ver'], ['orden_trabajo', 'crear'], ['orden_trabajo', 'editar'],
        ['proveedor', 'ver'], ['proveedor', 'crear'], ['proveedor', 'editar'],
        ['documento', 'ver'], ['documento', 'crear'], ['documento', 'editar'],
        ['media', 'ver'], ['media', 'crear'],
        ['dano', 'ver'], ['dano', 'crear'], ['dano', 'editar'],
        ['prospecto', 'ver'], ['prospecto', 'crear'], ['prospecto', 'editar'],
        ['cita', 'ver'], ['cita', 'crear'],
        ['oferta', 'ver'], ['oferta', 'crear'],
        ['apartado', 'ver'], ['apartado', 'crear'], ['apartado', 'editar'],
        ['venta', 'ver'], ['venta', 'crear'], ['venta', 'editar'],
        ['consignacion', 'ver'], ['consignacion', 'crear'], ['consignacion', 'editar'],
        ['comision', 'ver'], ['comision', 'autorizar'],
        ['socio', 'ver'], ['socio', 'crear'], ['socio', 'editar'],
        ['aportacion', 'ver'], ['aportacion', 'crear'],
        ['liquidacion', 'ver'], ['liquidacion', 'crear'],
        ['cierre_financiero', 'ver'], ['cierre_financiero', 'crear'], ['cierre_financiero', 'editar'],
        ['auditoria', 'ver'],
    ];

    /**
     * gerencia/comisionista/demo → [[recurso, accion, ambito], ...].
     * Todo lo que no aparece aqui para un rol se resuelve 'ninguno'.
     *
     * @var array<string, array<int, array{0: string, 1: string, 2: string}>>
     */
    private const AMBITOS = [
        'gerencia' => [
            ['vehiculo', 'ver', 'todos'], ['vehiculo', 'crear', 'todos'], ['vehiculo', 'editar', 'todos'], ['vehiculo', 'publicar', 'todos'],
            ['compra', 'ver', 'todos'], ['compra', 'crear', 'todos'],
            ['orden_trabajo', 'ver', 'todos'], ['orden_trabajo', 'crear', 'todos'], ['orden_trabajo', 'editar', 'todos'],
            ['proveedor', 'ver', 'todos'], ['proveedor', 'crear', 'todos'], ['proveedor', 'editar', 'todos'],
            ['documento', 'ver', 'todos'], ['documento', 'crear', 'todos'], ['documento', 'editar', 'todos'],
            ['media', 'ver', 'todos'], ['media', 'crear', 'todos'],
            ['dano', 'ver', 'todos'], ['dano', 'crear', 'todos'], ['dano', 'editar', 'todos'],
            ['prospecto', 'ver', 'todos'], ['prospecto', 'crear', 'todos'], ['prospecto', 'editar', 'todos'],
            ['cita', 'ver', 'todos'], ['cita', 'crear', 'todos'],
            ['apartado', 'ver', 'todos'], ['apartado', 'crear', 'todos'], ['apartado', 'editar', 'todos'],
            ['venta', 'ver', 'todos'], ['venta', 'crear', 'todos'], ['venta', 'editar', 'todos'],
            ['consignacion', 'ver', 'todos'], ['consignacion', 'crear', 'todos'], ['consignacion', 'editar', 'todos'],
        ],
        'comisionista' => [
            ['vehiculo', 'ver', 'todos'], // ficha publica, redactada — RN-23
            ['media', 'ver', 'todos'], // solo es_publicable=1, filtro de fila aparte
            ['prospecto', 'ver', 'propios'], ['prospecto', 'crear', 'propios'], ['prospecto', 'editar', 'propios'],
            ['cita', 'ver', 'propios'], ['cita', 'crear', 'propios'],
            ['venta', 'ver', 'propios'],
            ['comision', 'ver', 'propios'],
        ],
        'demo' => [
            ['usuario', 'ver', 'todos'],
            ['vehiculo', 'ver', 'todos'],
            ['compra', 'ver', 'todos'],
            ['evaluacion_puja', 'ver', 'todos'],
            ['gasto', 'ver', 'todos'],
            ['orden_trabajo', 'ver', 'todos'],
            ['proveedor', 'ver', 'todos'],
            ['documento', 'ver', 'todos'],
            ['media', 'ver', 'todos'],
            ['dano', 'ver', 'todos'],
            ['prospecto', 'ver', 'todos'],
            ['cita', 'ver', 'todos'],
            ['oferta', 'ver', 'todos'],
            ['apartado', 'ver', 'todos'],
            ['venta', 'ver', 'todos'],
            ['consignacion', 'ver', 'todos'],
            ['comision', 'ver', 'todos'],
            ['socio', 'ver', 'todos'],
            ['aportacion', 'ver', 'todos'],
            ['liquidacion', 'ver', 'todos'],
            ['cierre_financiero', 'ver', 'todos'],
            // Todo importe se muestra como 000000 (CA-14) — eso es redaccion
            // de campo, no de fila: demo SI ve estas filas, pero ficticias.
        ],
    ];

    public function run(): void
    {
        foreach (self::RECURSO_ACCION as [$recurso, $accion]) {
            Permiso::firstOrCreate(['recurso' => $recurso, 'accion' => $accion]);
        }

        foreach (self::AMBITOS as $claveRol => $filas) {
            $rol = Rol::where('clave', $claveRol)->first();

            if (! $rol) {
                continue;
            }

            foreach ($filas as [$recurso, $accion, $ambito]) {
                $permiso = Permiso::where(['recurso' => $recurso, 'accion' => $accion])->first();

                if (! $permiso) {
                    continue;
                }

                $rol->permisos()->syncWithoutDetaching([$permiso->id => ['ambito' => $ambito]]);
            }
        }
    }
}
