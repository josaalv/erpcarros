<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Tarea extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'tarea';

    protected $fillable = [
        'orden_trabajo_id', 'descripcion', 'asignado_id', 'estado', 'avance', 'observaciones',
    ];

    protected function casts(): array
    {
        return ['avance' => 'integer'];
    }

    public function ordenTrabajo(): BelongsTo
    {
        return $this->belongsTo(OrdenTrabajo::class);
    }

    public function asignado(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'asignado_id');
    }
}
