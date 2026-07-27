<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ubicacion extends Model
{
    protected $table = 'ubicacion';

    public $timestamps = false;

    protected $fillable = ['clave', 'nombre', 'es_externa', 'activo'];

    protected function casts(): array
    {
        return [
            'es_externa' => 'boolean',
            'activo' => 'boolean',
        ];
    }
}
