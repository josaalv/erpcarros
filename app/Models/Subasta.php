<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Subasta extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'subasta';

    protected $fillable = ['plataforma', 'fecha', 'lote', 'num_comprador', 'patio_origen'];

    protected function casts(): array
    {
        return ['fecha' => 'date'];
    }

    public function evaluaciones(): HasMany
    {
        return $this->hasMany(EvaluacionPuja::class);
    }

    public function compras(): HasMany
    {
        return $this->hasMany(Compra::class);
    }
}
