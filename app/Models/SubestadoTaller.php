<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubestadoTaller extends Model
{
    protected $table = 'subestado_taller';

    public $timestamps = false;

    protected $fillable = ['clave', 'nombre', 'activo'];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }
}
