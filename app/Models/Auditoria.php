<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Bitacora de auditoria (M15): creacion, modificacion, borrado, accesos,
 * descargas, cambios de precio, cierres y reaperturas. Append-only.
 */
class Auditoria extends Model
{
    protected $table = 'auditoria';

    const CREATED_AT = 'ocurrido';

    const UPDATED_AT = null;

    protected $fillable = [
        'usuario_id', 'accion', 'entidad', 'entidad_id', 'valores_anteriores', 'valores_nuevos', 'ip',
    ];

    protected function casts(): array
    {
        return [
            'valores_anteriores' => 'array',
            'valores_nuevos' => 'array',
            'ocurrido' => 'datetime',
        ];
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class);
    }
}
