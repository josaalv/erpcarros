<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Aportacion extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'aportacion';

    protected $fillable = ['vehiculo_id', 'socio_id', 'concepto', 'gasto_id', 'monto', 'fecha', 'comprobante_path'];

    protected function casts(): array
    {
        return [
            'monto' => 'decimal:2',
            'fecha' => 'date',
        ];
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function socio(): BelongsTo
    {
        return $this->belongsTo(Socio::class);
    }

    public function gasto(): BelongsTo
    {
        return $this->belongsTo(Gasto::class);
    }
}
