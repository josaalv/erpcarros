<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Documento extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'documento';

    protected $fillable = [
        'vehiculo_id', 'tipo_documento_id', 'archivo_path', 'archivo_nombre', 'archivo_bytes',
        'estado', 'fecha_obtencion', 'observaciones',
    ];

    protected function casts(): array
    {
        return [
            'archivo_bytes' => 'integer',
            'fecha_obtencion' => 'date',
        ];
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function tipoDocumento(): BelongsTo
    {
        return $this->belongsTo(TipoDocumento::class);
    }
}
