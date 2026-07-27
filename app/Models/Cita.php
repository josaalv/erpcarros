<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Cita extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'cita';

    protected $fillable = ['prospecto_id', 'vehiculo_id', 'cuando', 'lugar', 'estado'];

    protected function casts(): array
    {
        return ['cuando' => 'datetime'];
    }

    public function prospecto(): BelongsTo
    {
        return $this->belongsTo(Prospecto::class);
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }
}
