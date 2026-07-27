# Despliegue — ERP Vehículos

Adaptado del patrón ya probado en `robsen-salon` (ver
`docs/kit-aterrizaje-referencia.md`), con los ajustes propios de esta app:
es Laravel completo (backend + frontend compilado), no solo estáticos.

## Estado actual

**El workflow (`.github/workflows/deploy.yml`) todavía NO está activo.**
Dispara solo manualmente (`workflow_dispatch`) a propósito, hasta completar
el checklist de abajo. Actívalo cambiando el `on:` a `push: branches:
[main]` solo después del paso 3.

## Checklist antes de activar el deploy automático

1. [ ] Dominio (aunque sea temporal de Hostinger) identificado.
2. [ ] Cuenta FTP dedicada creada en Hostinger para ese dominio.
3. [ ] **Verificación manual de la ruta FTP — obligatoria, no te la
   saltes.** Conecta con `lftp` a mano usando las credenciales exactas que
   usará el deploy, sube un archivo de nombre único (timestamp + random) y
   pídelo por HTTP directo al dominio real. Si no aparece, la ruta está
   mal — no automatices todavía. Ver la sección completa en
   `docs/kit-aterrizaje-referencia.md` (es el mismo procedimiento que costó
   horas diagnosticar en `robsen-salon` cuando `FTP-Deploy-Action` reportaba
   éxito escribiendo en un directorio vacío y paralelo).
4. [ ] Base de datos MySQL 8 creada en hPanel, con su propio usuario y
   contraseña (no reutilizar credenciales de otro proyecto). Confirmar
   versión con `SELECT VERSION();` — el esquema usa `CHECK`, `JSON` y
   funciones de ventana, que requieren MySQL 8 real (no MariaDB, no MySQL
   5.7).
5. [ ] Secrets en GitHub → Settings → Secrets and variables → Actions:
   `APP_KEY` (genera con `php artisan key:generate --show`),
   `HOSTINGER_DB_HOST`, `HOSTINGER_DB_DATABASE`, `HOSTINGER_DB_USERNAME`,
   `HOSTINGER_DB_PASSWORD`, `HOSTINGER_FTP_SERVER`,
   `HOSTINGER_FTP_USERNAME`, `HOSTINGER_FTP_PASSWORD`.
6. [ ] Backup de MySQL programado desde el día uno (mysqldump vía cron de
   Hostinger o GitHub Actions con acceso a la base). No hay pipeline
   automático de respaldo todavía — pendiente de construir.

## Pendiente de decidir: cómo correr las migraciones en producción

El workflow sube archivos por FTP, pero **no ejecuta
`php artisan migrate --force`** contra la MySQL de Hostinger. Dos rutas
posibles, dependiendo de qué incluya el plan de Hostinger:

- **Si el plan da acceso SSH:** agregar un paso al workflow que se
  conecte por SSH y corra `php artisan migrate --force` después de subir
  los archivos.
- **Si no hay SSH:** correr las migraciones a mano vía el SQL Editor de
  hPanel o `phpMyAdmin`, replicando el mismo orden de
  `docs/analisis-fuente/01-esquema-base-datos.txt` §11. Esto es lo que
  hacemos hoy en desarrollo local — ver más abajo.

No asumas una respuesta: confírmalo contra el plan de Hostinger real antes
de automatizar este paso.

## Riesgo conocido: triggers y `SUPER` privilege

Al correr `php artisan migrate` localmente (MySQL 8 con binary log
activado), crear los triggers de `trg_gasto_bloqueo_cierre` y afines
falló con:

```
SQLSTATE[HY000]: General error: 1419 You do not have the SUPER privilege
and binary logging is enabled
```

Se resolvió en local con `SET GLOBAL log_bin_trust_function_creators = 1;`
como root. **En Hostinger es probable que el usuario de la base de datos
NO tenga privilegio `SUPER`** (hosting compartido no lo da) y esa misma
variable tampoco se pueda ajustar sin ese privilegio. Antes de dar por
bueno el deploy a producción:

1. Confirma si Hostinger ya trae `log_bin_trust_function_creators=1` por
   default (común en muchos hostings compartidos porque no exponen
   binlog), o si hay que pedir soporte para activarlo.
2. Si no se puede activar, los triggers habría que crearlos con
   `DEFINER` explícito o replantear el bloqueo de cierre financiero como
   validación en la aplicación (Eloquent) además de en la base de datos.
   No lo asumas resuelto sin probarlo contra la base real de Hostinger.

## Desarrollo local

Este sandbox corre MySQL 8.0.46 real (no MariaDB) para poder validar el
esquema con fidelidad — ver `.env` para las credenciales de desarrollo
(`erpcarros` / base `erpcarros`). Comandos típicos:

```
php artisan migrate:fresh --seed   # recrea todo el esquema + catálogos + admin
php artisan tinker                 # probar modelos Eloquent
```

Credenciales del usuario administrador sembrado por
`UsuarioAdminSeeder`: `admin@erpcarros.test` / `cambia-esta-contrasena`
— cámbiala antes de exponer el panel.

## Verificación de cálculo financiero (obligatoria antes de construir pantallas)

Antes de dar por bueno el esquema en cualquier entorno, reproduce las tres
unidades reales ya cerradas y compara contra estos números exactos (ver
`docs/analisis-fuente/01-esquema-base-datos.txt` §"Cómo comprobar que el
esquema quedó bien"):

| Unidad            | costo_total | utilidad   | margen |
|-------------------|------------:|-----------:|-------:|
| Mirage 2022       |  142,580.00 |  37,420.00 | 0.2079 |
| Jetta 2018        |  204,330.00 |  10,670.00 | 0.0496 |
| Hilux diesel 2020 |  344,860.00 | 105,140.00 | 0.2336 |

El caso de Mirage 2022 ya se verificó en este entorno de desarrollo
(dentro de una transacción `BEGIN`/`ROLLBACK`, sin dejar datos): la vista
`v_costo_vehiculo` devolvió `costo_total = 142580.00`,
`utilidad = 37420.00`, `margen = 0.2079` — exacto al peso. Faltan Jetta
2018 e Hilux diésel 2020 (esta última con reparto a dos socios) antes de
construir pantallas.
