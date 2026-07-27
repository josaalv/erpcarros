<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * RN-27 a RN-30: el precio asignado al lote es lo que paga al vender
 * (nunca el precio autorizado de venta directa), y una unidad en
 * consignacion sigue siendo tuya (el lote no modifica el expediente).
 */
class Consignacion extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'consignacion';

    protected $fillable = [
        'vehiculo_id', 'lote_id', 'precio_asignado', 'fecha_envio', 'fecha_retiro',
        'estado', 'fecha_venta_reportada', 'fecha_pago_recibido',
        'evidencia_entrega_path', 'evidencia_pago_path', 'observaciones',
    ];

    protected function casts(): array
    {
        return [
            'precio_asignado' => 'decimal:2',
            'fecha_envio' => 'date',
            'fecha_retiro' => 'date',
            'fecha_venta_reportada' => 'date',
            'fecha_pago_recibido' => 'date',
        ];
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function lote(): BelongsTo
    {
        return $this->belongsTo(Lote::class);
    }

    public function venta(): HasOne
    {
        return $this->hasOne(Venta::class);
    }
}
