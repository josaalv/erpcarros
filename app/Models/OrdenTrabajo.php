<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrdenTrabajo extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'orden_trabajo';

    protected $fillable = [
        'folio', 'vehiculo_id', 'tipo', 'especialidad', 'proveedor_id', 'responsable_id',
        'descripcion', 'prioridad', 'fecha_inicio', 'fecha_estimada', 'fecha_real',
        'estado', 'garantia_dias', 'es_retrabajo', 'ot_origen_id', 'observaciones',
    ];

    protected function casts(): array
    {
        return [
            'fecha_inicio' => 'date',
            'fecha_estimada' => 'date',
            'fecha_real' => 'date',
            'garantia_dias' => 'integer',
            'es_retrabajo' => 'boolean',
        ];
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function proveedor(): BelongsTo
    {
        return $this->belongsTo(Proveedor::class);
    }

    public function responsable(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'responsable_id');
    }

    public function ordenOrigen(): BelongsTo
    {
        return $this->belongsTo(OrdenTrabajo::class, 'ot_origen_id');
    }

    public function tareas(): HasMany
    {
        return $this->hasMany(Tarea::class);
    }

    public function gastos(): HasMany
    {
        return $this->hasMany(Gasto::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(Media::class);
    }
}
