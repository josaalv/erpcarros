<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TipoDocumento extends Model
{
    protected $table = 'tipo_documento';

    public $timestamps = false;

    protected $fillable = ['clave', 'nombre', 'obligatorio', 'confidencial', 'orden', 'activo'];

    protected function casts(): array
    {
        return [
            'obligatorio' => 'boolean',
            'confidencial' => 'boolean',
            'activo' => 'boolean',
        ];
    }
}
