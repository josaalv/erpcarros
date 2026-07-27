<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Rol extends Model
{
    protected $table = 'rol';

    public $timestamps = false;

    protected $fillable = ['clave', 'nombre', 'descripcion', 'es_sistema'];

    protected function casts(): array
    {
        return [
            'es_sistema' => 'boolean',
        ];
    }

    public function usuarios(): HasMany
    {
        return $this->hasMany(Usuario::class);
    }

    public function permisos(): BelongsToMany
    {
        return $this->belongsToMany(Permiso::class, 'rol_permiso')->withPivot('ambito');
    }
}
