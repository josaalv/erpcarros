# ERP Vehículos

ERP interno para un negocio de compra, reparación y venta de vehículos
(arbitraje de activos: subasta → taller → venta). Ver `CLAUDE.md` para la
guía operativa completa y `docs/` para el análisis de negocio original.

## Stack

- React 19 + TypeScript + Vite
- Supabase (Postgres + Auth + RLS) como único backend — sin servidor propio
- Deploy: GitHub Pages (build estático que habla directo con Supabase)

## Desarrollo local

```bash
npm install
cp .env.example .env
# Rellena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (Supabase → Project Settings → API)
npm run dev
```

La primera cuenta que se registra en la pantalla de login se vuelve
administrador automáticamente (ver función `handle_new_user` en
`supabase/migrations/`).

## Documentación

- `docs/analisis-fuente/` — documento de análisis de negocio (reglas
  RN-01..RN-30, permisos, MVP) y el prototipo de frontend original.
- `docs/DEPLOY.md` — flujo de despliegue a GitHub Pages.
