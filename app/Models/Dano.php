<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Dano extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'dano';

    protected $fillable = [
        'vehiculo_id', 'zona', 'tipo', 'severidad', 'detectado_en', 'descripcion', 'resuelto',
    ];

    protected function casts(): array
    {
        return ['resuelto' => 'boolean'];
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }
}
