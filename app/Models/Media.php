<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * es_publicable determina si es visible al comisionista (RN-23): el
 * material compartido nunca incluye VIN completo, costos ni documentos
 * internos, y las fotos/videos no publicables se filtran en la capa de
 * autorizacion, no aqui.
 */
class Media extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'media';

    protected $fillable = [
        'vehiculo_id', 'orden_trabajo_id', 'tipo', 'etapa', 'archivo_path',
        'es_publicable', 'orden',
    ];

    protected function casts(): array
    {
        return [
            'es_publicable' => 'boolean',
            'orden' => 'integer',
        ];
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function ordenTrabajo(): BelongsTo
    {
        return $this->belongsTo(OrdenTrabajo::class);
    }
}
