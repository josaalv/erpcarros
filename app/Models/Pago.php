<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Pago extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'pago';

    protected $fillable = [
        'tipo', 'vehiculo_id', 'proveedor_id', 'socio_id', 'comisionista_id', 'venta_id',
        'importe', 'fecha', 'metodo', 'referencia', 'comprobante_path',
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

    public function proveedor(): BelongsTo
    {
        return $this->belongsTo(Proveedor::class);
    }

    public function socio(): BelongsTo
    {
        return $this->belongsTo(Socio::class);
    }

    public function comisionista(): BelongsTo
    {
        return $this->belongsTo(Comisionista::class);
    }

    public function venta(): BelongsTo
    {
        return $this->belongsTo(Venta::class);
    }
}
