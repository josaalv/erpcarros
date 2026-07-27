<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Comisionista extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'comisionista';

    protected $fillable = ['nombre', 'telefono', 'correo', 'usuario_id', 'ver_comisiones', 'activo'];

    protected function casts(): array
    {
        return [
            'ver_comisiones' => 'boolean',
            'activo' => 'boolean',
        ];
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class);
    }

    public function prospectos(): HasMany
    {
        return $this->hasMany(Prospecto::class);
    }

    public function comisiones(): HasMany
    {
        return $this->hasMany(Comision::class);
    }
}
