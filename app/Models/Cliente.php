<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Cliente extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'cliente';

    protected $fillable = ['nombre', 'telefono', 'correo', 'origen', 'notas'];

    public function prospectos(): HasMany
    {
        return $this->hasMany(Prospecto::class);
    }
}
