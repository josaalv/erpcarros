<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Proveedor extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'proveedor';

    protected $fillable = [
        'nombre', 'empresa', 'especialidad', 'telefono', 'correo', 'direccion',
        'es_gestor', 'calificacion', 'notas', 'activo',
    ];

    protected function casts(): array
    {
        return [
            'es_gestor' => 'boolean',
            'activo' => 'boolean',
        ];
    }

    public function ordenesTrabajo(): HasMany
    {
        return $this->hasMany(OrdenTrabajo::class);
    }

    public function tramites(): HasMany
    {
        return $this->hasMany(Tramite::class, 'gestor_id');
    }
}
