<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EstadoProceso extends Model
{
    protected $table = 'estado_proceso';

    public $timestamps = false;

    protected $fillable = ['clave', 'nombre', 'orden', 'es_final', 'activo'];

    protected function casts(): array
    {
        return [
            'es_final' => 'boolean',
            'activo' => 'boolean',
        ];
    }
}
