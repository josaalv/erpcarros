<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CategoriaGasto extends Model
{
    protected $table = 'categoria_gasto';

    public $timestamps = false;

    protected $fillable = ['clave', 'nombre', 'grupo', 'es_interno', 'orden', 'activo'];

    protected function casts(): array
    {
        return [
            'es_interno' => 'boolean',
            'activo' => 'boolean',
        ];
    }
}
