<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Interaccion extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'interaccion';

    protected $fillable = ['prospecto_id', 'tipo', 'ocurrido', 'resultado', 'nota'];

    protected function casts(): array
    {
        return ['ocurrido' => 'datetime'];
    }

    public function prospecto(): BelongsTo
    {
        return $this->belongsTo(Prospecto::class);
    }
}
