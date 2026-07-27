<?php

namespace App\Models;

use Illuminate\Auth\Authenticatable;
use Illuminate\Auth\Passwords\CanResetPassword;
use Illuminate\Contracts\Auth\Access\Authorizable as AuthorizableContract;
use Illuminate\Contracts\Auth\Authenticatable as AuthenticatableContract;
use Illuminate\Contracts\Auth\CanResetPassword as CanResetPasswordContract;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\Access\Authorizable;
use Illuminate\Notifications\Notifiable;

/**
 * Autenticación propia sobre la tabla 'usuario' (no 'users' de Laravel),
 * con columnas en español según el esquema de base de datos del proyecto.
 *
 * Nota: NO usa el trait TieneBloqueEstandar (a diferencia del resto de
 * modelos operativos) a proposito. Ese trait consulta Auth::user() en sus
 * eventos de modelo, y Auth::user() resuelve precisamente consultando este
 * mismo modelo — aplicarlo aqui arriesga recursion durante la propia
 * autenticacion. Solo SoftDeletes (RN-22); sin filtro es_demo ni bloqueo
 * de escritura automatico para esta tabla especifica.
 */
class Usuario extends Model implements AuthenticatableContract, AuthorizableContract, CanResetPasswordContract
{
    use Authenticatable, Authorizable, CanResetPassword, Notifiable, SoftDeletes;

    protected $table = 'usuario';

    protected $fillable = [
        'nombre', 'correo', 'password_hash', 'rol_id', 'telefono', 'activo',
    ];

    protected $hidden = ['password_hash', 'mfa_secreto'];

    protected function casts(): array
    {
        return [
            'activo' => 'boolean',
            'es_demo' => 'boolean',
            'ultimo_acceso' => 'datetime',
        ];
    }

    public function getAuthPassword(): string
    {
        return $this->password_hash;
    }

    public function getAuthPasswordName(): string
    {
        return 'password_hash';
    }

    public function getEmailForPasswordReset(): string
    {
        return $this->correo;
    }

    public function routeNotificationForMail(): string
    {
        return $this->correo;
    }

    public function rol(): BelongsTo
    {
        return $this->belongsTo(Rol::class);
    }

    public function comisionista(): HasOne
    {
        return $this->hasOne(Comisionista::class);
    }

    public function socio(): HasOne
    {
        return $this->hasOne(Socio::class);
    }

    public function esRol(string $clave): bool
    {
        return $this->rol?->clave === $clave;
    }

    /**
     * Ambito de acceso de este usuario sobre (recurso, accion): 'todos',
     * 'propios' o 'ninguno'. Admin siempre 'todos' (bypass explicito, no
     * hay filas de admin en rol_permiso — ver PermisoSeeder). El resto se
     * resuelve contra la tabla rol_permiso: "los permisos son datos, no
     * codigo" (fuente de verdad del esquema). Sin fila = 'ninguno', nunca
     * se asume acceso por omision.
     */
    public function ambitoPara(string $recurso, string $accion): string
    {
        if ($this->esRol('admin')) {
            return 'todos';
        }

        if (! $this->activo) {
            return 'ninguno';
        }

        $permiso = $this->rol
            ?->permisos()
            ->where('recurso', $recurso)
            ->where('accion', $accion)
            ->first();

        return $permiso?->pivot->ambito ?? 'ninguno';
    }

    public function puede(string $recurso, string $accion): bool
    {
        return $this->ambitoPara($recurso, $accion) !== 'ninguno';
    }

    public function soloPropios(string $recurso, string $accion): bool
    {
        return $this->ambitoPara($recurso, $accion) === 'propios';
    }

    /**
     * RN-12 y fila "Precio autorizado / precio minimo" de la Tabla 2:
     * precio_minimo jamas sale del rol administrador.
     */
    public function vePrecioMinimo(): bool
    {
        return $this->esRol('admin');
    }

    /**
     * Fila "Costo acumulado, utilidad, margen" de la Tabla 2: total para
     * admin, nada para gerencia/comisionista, ficticio (000000) para demo.
     */
    public function veCifrasFinancieras(): bool
    {
        return $this->esRol('admin') || $this->esRol('demo');
    }
}
