<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * No guarda costo: el dinero vive siempre en 'gasto', en un solo lugar.
 */
class Tramite extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'tramite';

    protected $fillable = [
        'vehiculo_id', 'tipo', 'gestor_id', 'fecha_envio', 'fecha_estimada',
        'fecha_real', 'estado', 'observaciones',
    ];

    protected function casts(): array
    {
        return [
            'fecha_envio' => 'date',
            'fecha_estimada' => 'date',
            'fecha_real' => 'date',
        ];
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function gestor(): BelongsTo
    {
        return $this->belongsTo(Proveedor::class, 'gestor_id');
    }
}
