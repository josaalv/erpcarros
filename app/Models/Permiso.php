<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Permiso extends Model
{
    protected $table = 'permiso';

    public $timestamps = false;

    protected $fillable = ['recurso', 'accion', 'ambito'];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Rol::class, 'rol_permiso')->withPivot('ambito');
    }
}
