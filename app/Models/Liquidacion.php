<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * RN-08: no se genera si el vehiculo tiene gastos en estado 'pendiente'
 * (ver App\Services\CierreService, pendiente de construir).
 */
class Liquidacion extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'liquidacion';

    protected $fillable = [
        'cierre_id', 'vehiculo_id', 'socio_id', 'capital_aportado', 'participacion',
        'utilidad_asignada', 'monto_a_pagar', 'pagado', 'fecha_pago', 'comprobante_path',
    ];

    protected function casts(): array
    {
        return [
            'capital_aportado' => 'decimal:2',
            'participacion' => 'decimal:4',
            'utilidad_asignada' => 'decimal:2',
            'monto_a_pagar' => 'decimal:2',
            'pagado' => 'boolean',
            'fecha_pago' => 'date',
        ];
    }

    public function cierre(): BelongsTo
    {
        return $this->belongsTo(CierreFinanciero::class, 'cierre_id');
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function socio(): BelongsTo
    {
        return $this->belongsTo(Socio::class);
    }
}
