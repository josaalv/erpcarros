<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Historial append-only: sin bloque estandar, no se edita ni se borra.
 */
class CambioEstado extends Model
{
    protected $table = 'cambio_estado';

    public $timestamps = false;

    protected $fillable = ['vehiculo_id', 'eje', 'valor_anterior', 'valor_nuevo', 'nota', 'usuario_id', 'ocurrido'];

    protected function casts(): array
    {
        return ['ocurrido' => 'datetime'];
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class);
    }
}
