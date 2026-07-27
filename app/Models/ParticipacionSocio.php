<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Solo lectura: mapea la vista v_participacion_socio (RN-07). Sin llave
 * primaria propia (vehiculo_id + socio_id); no se escribe nunca a traves
 * de este modelo.
 */
class ParticipacionSocio extends Model
{
    protected $table = 'v_participacion_socio';

    public $incrementing = false;

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'capital_aportado' => 'decimal:2',
            'participacion' => 'decimal:4',
        ];
    }
}
