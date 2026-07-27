<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Solo lectura: mapea la vista v_roi_segmento (RN-05). Alimenta la
 * advertencia de la calculadora de puja. No se escribe nunca a traves de
 * este modelo.
 */
class RoiSegmento extends Model
{
    protected $table = 'v_roi_segmento';

    public $incrementing = false;

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'unidades' => 'integer',
            'margen_promedio' => 'decimal:4',
            'roi_promedio' => 'decimal:4',
            'dias_promedio' => 'decimal:1',
        ];
    }
}
