<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Notificacion extends Model
{
    protected $table = 'notificacion';

    const CREATED_AT = 'creada';

    const UPDATED_AT = null;

    protected $fillable = ['usuario_id', 'tipo', 'mensaje', 'entidad', 'entidad_id', 'leida'];

    protected function casts(): array
    {
        return [
            'leida' => 'boolean',
            'creada' => 'datetime',
        ];
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class);
    }
}
