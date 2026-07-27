<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Historial, no un campo (RN-21): cuantas veces, cuando, quien y por que
 * se reabrio un cierre. Append-only, sin bloque estandar.
 */
class Reapertura extends Model
{
    protected $table = 'reapertura';

    public $timestamps = false;

    protected $fillable = ['cierre_id', 'motivo', 'usuario_id', 'ocurrido', 'cerrado_de_nuevo'];

    protected function casts(): array
    {
        return [
            'ocurrido' => 'datetime',
            'cerrado_de_nuevo' => 'datetime',
        ];
    }

    public function cierre(): BelongsTo
    {
        return $this->belongsTo(CierreFinanciero::class, 'cierre_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class);
    }
}
