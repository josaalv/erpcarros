<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * La tabla mas importante de la base de datos (RN-01): todo gasto
 * pertenece obligatoriamente a un vehiculo. RN-08: no se puede liquidar
 * una unidad con gastos en estado_pago = 'pendiente'. El CHECK
 * ck_gasto_pagador (pagador_tipo=socio => pagador_socio_id NOT NULL) ya
 * lo aplica la base de datos; aqui se valida tambien en Laravel para dar
 * un mensaje de error legible antes del round-trip a MySQL.
 */
class Gasto extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'gasto';

    protected $fillable = [
        'vehiculo_id', 'categoria_id', 'orden_trabajo_id', 'proveedor_id',
        'descripcion', 'importe', 'fecha', 'forma_pago', 'estado_pago',
        'pagador_tipo', 'pagador_socio_id', 'comprobante_path', 'observaciones',
    ];

    protected function casts(): array
    {
        return [
            'importe' => 'decimal:2',
            'fecha' => 'date',
        ];
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function categoria(): BelongsTo
    {
        return $this->belongsTo(CategoriaGasto::class, 'categoria_id');
    }

    public function ordenTrabajo(): BelongsTo
    {
        return $this->belongsTo(OrdenTrabajo::class);
    }

    public function proveedor(): BelongsTo
    {
        return $this->belongsTo(Proveedor::class);
    }

    public function pagadorSocio(): BelongsTo
    {
        return $this->belongsTo(Socio::class, 'pagador_socio_id');
    }
}
