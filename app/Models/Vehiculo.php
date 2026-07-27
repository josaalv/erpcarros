<?php

namespace App\Models;

use App\Models\Concerns\TieneBloqueEstandar;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * El centro del sistema: todo cuelga de vehiculo (RN-02). Los tres precios
 * (minimo, autorizado, lote) estan separados a proposito — precio_minimo
 * jamas debe salir del rol administrador (RN-12), esto se aplica en la
 * capa de autorizacion (VehiculoPolicy / Filament Resource), no aqui.
 */
class Vehiculo extends Model
{
    use TieneBloqueEstandar;

    protected $table = 'vehiculo';

    protected $fillable = [
        'id_interno', 'vin', 'marca', 'modelo', 'version', 'anio', 'kilometraje',
        'color', 'transmision', 'motor', 'equipamiento', 'descripcion_comercial',
        'estado_proceso_id', 'ubicacion_id', 'estado_comercial', 'estado_documental',
        'regimen_factura', 'fecha_compra', 'fecha_ingreso', 'fecha_estimada_fin',
        'fecha_real_fin', 'fecha_venta', 'fecha_entrega',
        'precio_minimo', 'precio_autorizado', 'precio_lote', 'canal_venta',
    ];

    protected function casts(): array
    {
        return [
            'anio' => 'integer',
            'kilometraje' => 'integer',
            'fecha_compra' => 'date',
            'fecha_ingreso' => 'date',
            'fecha_estimada_fin' => 'date',
            'fecha_real_fin' => 'date',
            'fecha_venta' => 'date',
            'fecha_entrega' => 'date',
            'precio_minimo' => 'decimal:2',
            'precio_autorizado' => 'decimal:2',
            'precio_lote' => 'decimal:2',
        ];
    }

    public function estadoProceso(): BelongsTo
    {
        return $this->belongsTo(EstadoProceso::class);
    }

    public function ubicacion(): BelongsTo
    {
        return $this->belongsTo(Ubicacion::class);
    }

    public function subestados(): BelongsToMany
    {
        return $this->belongsToMany(SubestadoTaller::class, 'vehiculo_subestado')
            ->withPivot(['desde', 'hasta']);
    }

    public function compra(): HasOne
    {
        return $this->hasOne(Compra::class);
    }

    public function evaluacionesPuja(): HasMany
    {
        return $this->hasMany(EvaluacionPuja::class);
    }

    public function gastos(): HasMany
    {
        return $this->hasMany(Gasto::class);
    }

    public function aportaciones(): HasMany
    {
        return $this->hasMany(Aportacion::class);
    }

    public function cambiosEstado(): HasMany
    {
        return $this->hasMany(CambioEstado::class);
    }

    public function movimientos(): HasMany
    {
        return $this->hasMany(Movimiento::class);
    }

    public function danos(): HasMany
    {
        return $this->hasMany(Dano::class);
    }

    public function diagnosticos(): HasMany
    {
        return $this->hasMany(Diagnostico::class);
    }

    public function ordenesTrabajo(): HasMany
    {
        return $this->hasMany(OrdenTrabajo::class);
    }

    public function documentos(): HasMany
    {
        return $this->hasMany(Documento::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(Media::class);
    }

    public function tramites(): HasMany
    {
        return $this->hasMany(Tramite::class);
    }

    public function consignaciones(): HasMany
    {
        return $this->hasMany(Consignacion::class);
    }

    public function prospectos(): HasMany
    {
        return $this->hasMany(Prospecto::class);
    }

    public function citas(): HasMany
    {
        return $this->hasMany(Cita::class);
    }

    public function ofertas(): HasMany
    {
        return $this->hasMany(Oferta::class);
    }

    public function apartados(): HasMany
    {
        return $this->hasMany(Apartado::class);
    }

    public function venta(): HasOne
    {
        return $this->hasOne(Venta::class);
    }

    public function cierreFinanciero(): HasOne
    {
        return $this->hasOne(CierreFinanciero::class);
    }

    public function costo(): HasOne
    {
        return $this->hasOne(CostoVehiculo::class, 'vehiculo_id');
    }

    public function inventarioDias(): HasOne
    {
        return $this->hasOne(InventarioDias::class, 'vehiculo_id');
    }

    public function participacionesSocios(): HasMany
    {
        return $this->hasMany(ParticipacionSocio::class, 'vehiculo_id');
    }

    /**
     * Dias de inventario desde la compra, no desde el ingreso (RN-04).
     * Atajo sobre v_inventario_dias para no forzar un join en cada uso.
     */
    public function diasInventario(): ?int
    {
        return $this->inventarioDias?->dias;
    }

    public function costoTotal(): ?string
    {
        return $this->costo?->costo_total;
    }
}
