<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Solo lectura: mapea la vista v_inventario_dias (RN-04). No se escribe
 * nunca a traves de este modelo.
 */
class InventarioDias extends Model
{
    protected $table = 'v_inventario_dias';

    protected $primaryKey = 'vehiculo_id';

    public $incrementing = false;

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'fecha_compra' => 'date',
            'hasta' => 'date',
            'dias' => 'integer',
            'costo_total' => 'decimal:2',
            'costo_por_dia' => 'decimal:2',
        ];
    }
}
