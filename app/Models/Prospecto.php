<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * RN-13: exclusividad de 15 dias naturales para el comisionista que
 * registra primero (vence_atribucion). RN-16: la exclusividad es sobre el
 * cliente, no sobre el par cliente-vehiculo.
 */
class Prospecto extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'prospecto';

    protected $fillable = [
        'cliente_id', 'vehiculo_id', 'comisionista_id', 'etapa',
        'fecha_registro', 'vence_atribucion', 'motivo_perdida',
    ];

    protected function casts(): array
    {
        return [
            'fecha_registro' => 'date',
            'vence_atribucion' => 'date',
        ];
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Cliente::class);
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function comisionista(): BelongsTo
    {
        return $this->belongsTo(Comisionista::class);
    }

    public function interacciones(): HasMany
    {
        return $this->hasMany(Interaccion::class);
    }

    public function citas(): HasMany
    {
        return $this->hasMany(Cita::class);
    }

    public function ofertas(): HasMany
    {
        return $this->hasMany(Oferta::class);
    }
}
