<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * El costo de adquisicion (precio, comision, impuestos, IVA) vive SOLO
 * aqui, nunca como gasto (ver decision documentada en el esquema).
 */
class Compra extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'compra';

    protected $fillable = [
        'vehiculo_id', 'subasta_id', 'precio', 'comision', 'impuestos', 'iva',
        'forma_pago', 'fecha_estimada_llegada', 'responsable_id', 'observaciones',
    ];

    protected function casts(): array
    {
        return [
            'precio' => 'decimal:2',
            'comision' => 'decimal:2',
            'impuestos' => 'decimal:2',
            'iva' => 'decimal:2',
            'fecha_estimada_llegada' => 'date',
        ];
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function subasta(): BelongsTo
    {
        return $this->belongsTo(Subasta::class);
    }

    public function responsable(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'responsable_id');
    }

    public function costoAdquisicion(): string
    {
        return bcadd(
            bcadd((string) $this->precio, (string) $this->comision, 2),
            bcadd((string) $this->impuestos, (string) $this->iva, 2),
            2
        );
    }
}
