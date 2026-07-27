<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Trazabilidad del portal de comisionistas (RN-24). Historial append-only:
 * sin bloque estandar, se escribe una vez por accion y no se edita.
 */
class AccesoFicha extends Model
{
    protected $table = 'acceso_ficha';

    public $timestamps = false;

    protected $fillable = ['comisionista_id', 'vehiculo_id', 'accion', 'ocurrido'];

    protected function casts(): array
    {
        return ['ocurrido' => 'datetime'];
    }

    public function comisionista(): BelongsTo
    {
        return $this->belongsTo(Comisionista::class);
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }
}
