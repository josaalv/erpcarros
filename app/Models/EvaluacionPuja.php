<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * La calculadora de puja (RN-05, M3). Guarda tambien pujas perdidas y
 * descartadas: es lo que permite calibrar el criterio de compra con el
 * historico real (v_roi_segmento).
 */
class EvaluacionPuja extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'evaluacion_puja';

    protected $fillable = [
        'subasta_id', 'vehiculo_id', 'marca', 'modelo', 'anio', 'danos_observados',
        'costo_reparacion_estimado', 'precio_venta_esperado', 'techo_puja',
        'roi_proyectado', 'roi_historico_segmento', 'advertencia_mostrada', 'resultado',
    ];

    protected function casts(): array
    {
        return [
            'anio' => 'integer',
            'costo_reparacion_estimado' => 'decimal:2',
            'precio_venta_esperado' => 'decimal:2',
            'techo_puja' => 'decimal:2',
            'roi_proyectado' => 'decimal:4',
            'roi_historico_segmento' => 'decimal:4',
            'advertencia_mostrada' => 'boolean',
        ];
    }

    public function subasta(): BelongsTo
    {
        return $this->belongsTo(Subasta::class);
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }
}
