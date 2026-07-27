<?php

namespace App\Services;

use App\Models\Aportacion;
use App\Models\Gasto;
use Illuminate\Support\Facades\DB;

/**
 * Decision documentada en el esquema (Codigo 9): cuando un socio paga un
 * gasto se generan DOS registros — el gasto (costo de la unidad) y la
 * aportacion vinculada (capital que ese socio metio) — siempre juntos en
 * una sola transaccion. Nunca uno sin el otro. Un gasto pagado por la
 * empresa no genera aportacion.
 */
class GastoService
{
    /**
     * @param  array<string, mixed>  $datos  Atributos de 'gasto' (vehiculo_id,
     *                                        categoria_id, descripcion, importe,
     *                                        fecha, pagador_tipo, pagador_socio_id...).
     */
    public function registrar(array $datos): Gasto
    {
        return DB::transaction(function () use ($datos) {
            $gasto = Gasto::create($datos);

            if ($gasto->pagador_tipo === 'socio') {
                Aportacion::create([
                    'vehiculo_id' => $gasto->vehiculo_id,
                    'socio_id' => $gasto->pagador_socio_id,
                    'concepto' => 'gasto',
                    'gasto_id' => $gasto->id,
                    'monto' => $gasto->importe,
                    'fecha' => $gasto->fecha,
                ]);
            }

            return $gasto;
        });
    }
}
