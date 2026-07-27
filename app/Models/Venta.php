<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * RN-19: una toma de vehiculo a cuenta genera automaticamente una unidad
 * nueva de inventario (veh_tomado_id), cuyo costo de adquisicion es el
 * valor de toma acordado — ver App\Services\VentaService (pendiente).
 * RN-28: si el canal es consignacion, precio_acordado debe ser exactamente
 * consignacion.precio_asignado.
 */
class Venta extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'venta';

    protected $fillable = [
        'vehiculo_id', 'cliente_id', 'comisionista_id', 'consignacion_id', 'canal',
        'precio_acordado', 'forma_pago', 'fecha_venta', 'fecha_entrega',
        'garantia_texto', 'garantia_dias', 'veh_tomado_id', 'valor_toma',
        'estado', 'observaciones',
    ];

    protected function casts(): array
    {
        return [
            'precio_acordado' => 'decimal:2',
            'fecha_venta' => 'date',
            'fecha_entrega' => 'date',
            'garantia_dias' => 'integer',
            'valor_toma' => 'decimal:2',
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

    public function consignacion(): BelongsTo
    {
        return $this->belongsTo(Consignacion::class);
    }

    public function vehiculoTomado(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class, 'veh_tomado_id');
    }

    public function comision(): HasOne
    {
        return $this->hasOne(Comision::class);
    }

    public function cierreFinanciero(): HasOne
    {
        return $this->hasOne(CierreFinanciero::class);
    }
}
