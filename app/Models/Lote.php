<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Lote extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'lote';

    protected $fillable = ['nombre', 'contacto', 'telefono', 'direccion', 'notas', 'activo'];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }

    public function consignaciones(): HasMany
    {
        return $this->hasMany(Consignacion::class);
    }
}
