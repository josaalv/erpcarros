<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IntentoAcceso extends Model
{
    protected $table = 'intento_acceso';

    const CREATED_AT = 'ocurrido';

    const UPDATED_AT = null;

    protected $fillable = ['correo', 'exito', 'ip', 'agente'];

    protected function casts(): array
    {
        return [
            'exito' => 'boolean',
            'ocurrido' => 'datetime',
        ];
    }
}
