<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Solo lectura: mapea la vista v_costo_vehiculo (Codigo 13). No se escribe
 * nunca a traves de este modelo.
 */
class CostoVehiculo extends Model
{
    protected $table = 'v_costo_vehiculo';

    protected $primaryKey = 'vehiculo_id';

    public $incrementing = false;

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'costo_adquisicion' => 'decimal:2',
            'total_gastos' => 'decimal:2',
            'costo_total' => 'decimal:2',
            'gastos_pendientes' => 'integer',
        ];
    }
}
