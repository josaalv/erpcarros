# ERP Vehículos

ERP interno para un negocio de compra, reparación y venta de vehículos
(arbitraje de activos: subasta → taller → venta). Ver `CLAUDE.md` para la
guía operativa completa y `docs/` para el análisis de negocio y el
esquema de base de datos originales.

## Stack

- Laravel 13 (PHP 8.3+) + Filament 3 (panel administrativo)
- MySQL 8 (Hostinger en producción)
- Vite + Tailwind para el panel

## Desarrollo local

Requiere PHP 8.3+, Composer, Node 20+ y MySQL 8 corriendo localmente.

```bash
composer install
cp .env.example .env
php artisan key:generate
# Ajusta DB_* en .env con tus credenciales de MySQL local
php artisan migrate:fresh --seed
npm install
npm run dev
```

El seeder crea los catálogos base y un usuario administrador:
`admin@erpcarros.test` / `cambia-esta-contrasena` (cámbiala antes de
exponer el panel). Panel en `http://localhost:8000/admin`.

## Documentación

- `docs/analisis-fuente/` — documento de análisis de negocio (reglas
  RN-01..RN-30, permisos, MVP), esquema de base de datos original, y
  prototipo de frontend navegable.
- `docs/DEPLOY.md` — flujo de despliegue a Hostinger y checklist
  pendiente antes de activarlo.
