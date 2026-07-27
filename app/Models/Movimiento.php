<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Historial append-only: sin bloque estandar, no se edita ni se borra.
 */
class Movimiento extends Model
{
    protected $table = 'movimiento';

    public $timestamps = false;

    protected $fillable = [
        'vehiculo_id', 'origen_id', 'destino_id', 'motivo', 'evidencia_path',
        'observaciones', 'usuario_id', 'ocurrido',
    ];

    protected function casts(): array
    {
        return ['ocurrido' => 'datetime'];
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function origen(): BelongsTo
    {
        return $this->belongsTo(Ubicacion::class, 'origen_id');
    }

    public function destino(): BelongsTo
    {
        return $this->belongsTo(Ubicacion::class, 'destino_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class);
    }
}
