<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Diagnostico extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'diagnostico';

    protected $fillable = ['vehiculo_id', 'fecha', 'responsable_id', 'hallazgos', 'presupuesto_estimado'];

    protected function casts(): array
    {
        return [
            'fecha' => 'date',
            'presupuesto_estimado' => 'decimal:2', // SOLO ROL ADMIN
        ];
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function responsable(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'responsable_id');
    }
}
