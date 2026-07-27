<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * RN-17: un vehiculo admite un solo apartado activo, vigencia 30 dias; al
 * vencer se libera automaticamente (ver App\Console\Commands que corra la
 * tarea programada diaria, pendiente de implementar).
 */
class Apartado extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'apartado';

    protected $fillable = [
        'vehiculo_id', 'cliente_id', 'comisionista_id', 'monto', 'fecha', 'vence',
        'estado', 'reembolsable', 'motivo_cancelacion',
    ];

    protected function casts(): array
    {
        return [
            'monto' => 'decimal:2',
            'fecha' => 'date',
            'vence' => 'date',
            'reembolsable' => 'boolean',
        ];
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Cliente::class);
    }

    public function comisionista(): BelongsTo
    {
        return $this->belongsTo(Comisionista::class);
    }
}
