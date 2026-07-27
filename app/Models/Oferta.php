<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * RN-14: SOLO la captura el administrador. El comisionista no negocia ni
 * captura ofertas.
 */
class Oferta extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'oferta';

    protected $fillable = ['prospecto_id', 'vehiculo_id', 'monto', 'fecha', 'estado', 'nota'];

    protected function casts(): array
    {
        return [
            'monto' => 'decimal:2',
            'fecha' => 'date',
        ];
    }

    public function prospecto(): BelongsTo
    {
        return $this->belongsTo(Prospecto::class);
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }
}
