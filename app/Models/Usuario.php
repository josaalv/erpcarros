<?php

namespace App\Models;

use Illuminate\Auth\Authenticatable;
use Illuminate\Auth\Passwords\CanResetPassword;
use Illuminate\Contracts\Auth\Authenticatable as AuthenticatableContract;
use Illuminate\Contracts\Auth\CanResetPassword as CanResetPasswordContract;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Notifications\Notifiable;

/**
 * Autenticación propia sobre la tabla 'usuario' (no 'users' de Laravel),
 * con columnas en español según el esquema de base de datos del proyecto.
 */
class Usuario extends Model implements AuthenticatableContract, CanResetPasswordContract
{
    use Authenticatable, CanResetPassword, Notifiable, SoftDeletes;

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

    public function esRol(string $clave): bool
    {
        return $this->rol?->clave === $clave;
    }
}
