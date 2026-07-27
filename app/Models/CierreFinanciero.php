<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * RN-20/RN-21: la unica tabla que guarda totales calculados (se congelan a
 * proposito). Los triggers trg_gasto_bloqueo_cierre* impiden gastos e
 * inmutan venta/liquidacion mientras estado='cerrado' — ver migracion
 * 2026_01_01_b00020. Reabrir es exclusivo del administrador con motivo
 * obligatorio (tabla 'reapertura').
 */
class CierreFinanciero extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'cierre_financiero';

    protected $fillable = [
        'vehiculo_id', 'venta_id', 'costo_total', 'precio_final', 'utilidad_bruta',
        'utilidad_neta', 'margen', 'roi', 'dias_inventario', 'costo_por_dia',
        'canal_venta', 'estado', 'cerrado_por', 'fecha_cierre',
    ];

    protected function casts(): array
    {
        return [
            'costo_total' => 'decimal:2',
            'precio_final' => 'decimal:2',
            'utilidad_bruta' => 'decimal:2',
            'utilidad_neta' => 'decimal:2',
            'margen' => 'decimal:4',
            'roi' => 'decimal:4',
            'dias_inventario' => 'integer',
            'costo_por_dia' => 'decimal:2',
            'fecha_cierre' => 'datetime',
        ];
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function venta(): BelongsTo
    {
        return $this->belongsTo(Venta::class);
    }

    public function cerradoPor(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'cerrado_por');
    }

    public function reaperturas(): HasMany
    {
        return $this->hasMany(Reapertura::class, 'cierre_id');
    }

    public function liquidaciones(): HasMany
    {
        return $this->hasMany(Liquidacion::class, 'cierre_id');
    }
}
