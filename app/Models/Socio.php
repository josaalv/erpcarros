<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Socio extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'socio';

    protected $fillable = ['nombre', 'telefono', 'correo', 'usuario_id', 'notas', 'activo'];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class);
    }

    public function aportaciones(): HasMany
    {
        return $this->hasMany(Aportacion::class);
    }

    public function liquidaciones(): HasMany
    {
        return $this->hasMany(Liquidacion::class);
    }
}
