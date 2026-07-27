<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * RN-18: pasa a autorizada solo con venta completada, pago del cliente
 * confirmado, vehiculo entregado y documentacion cerrada.
 */
class Comision extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'comision';

    protected $fillable = [
        'venta_id', 'comisionista_id', 'esquema', 'valor_esquema', 'monto_estimado',
        'monto_autorizado', 'autorizado_por', 'fecha_autorizacion', 'monto_pagado',
        'fecha_pago', 'metodo_pago', 'comprobante_path',
    ];

    protected function casts(): array
    {
        return [
            'valor_esquema' => 'decimal:4',
            'monto_estimado' => 'decimal:2',
            'monto_autorizado' => 'decimal:2',
            'fecha_autorizacion' => 'date',
            'monto_pagado' => 'decimal:2',
            'fecha_pago' => 'date',
        ];
    }

    public function venta(): BelongsTo
    {
        return $this->belongsTo(Venta::class);
    }

    public function comisionista(): BelongsTo
    {
        return $this->belongsTo(Comisionista::class);
    }

    public function autorizadoPor(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'autorizado_por');
    }
}
