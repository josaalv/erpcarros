# ERP Vehículos — guía operativa para Claude

ERP para un negocio de compra, reparación y venta de vehículos (arbitraje
de activos con valor agregado: subasta → taller → venta, ciclo ~30 días,
12 unidades activas, 6 usuarios). Este archivo es memoria persistente: se
lee automáticamente al abrir el repo.

## ⚠️ Historial de arquitectura — leer antes de asumir nada

Este proyecto tuvo **dos diseños distintos**:

1. **Diseño original (documentado en `docs/analisis-fuente/`):** Laravel +
   Filament + MySQL 8 en Hostinger. Justificado en el análisis de negocio
   original por vivir en la infraestructura que el dueño ya paga.
2. **Diseño actual (el que corre hoy):** React + TypeScript + Vite +
   **Supabase** (Postgres + Auth + RLS), desplegado a **GitHub Pages**
   como sitio estático. Se cambió a mitad de la implementación porque el
   dueño ya tenía un proyecto de Supabase conectado y quería ver la
   interfaz funcionando en un link real de GitHub sin pasar por el
   proceso de aprovisionar Hostinger (dominio, FTP, MySQL) primero.

**El código de Laravel se eliminó del repo** (queda en el historial de git
si hace falta consultarlo: `git log --diff-filter=D -- app/`).

**`docs/analisis-fuente/` ya NO está en el repo** (se quitó porque el repo
es público y esos documentos tenían cifras reales del negocio: márgenes
por unidad, tabla de rentabilidad de las 14 unidades, criterio de compra).
Si necesitas consultar las reglas de negocio completas (RN-01 a RN-30,
Tabla 2 de permisos, mapa de procesos), pídeselas al usuario directamente
o revisa el historial de git previo a su eliminación — **pero no las
vuelvas a committear al repo público**. Este `CLAUDE.md` ya resume lo
esencial de esas reglas en las secciones de abajo.

## Stack actual

- **Frontend:** React 19 + TypeScript + Vite. Sin framework de backend
  propio — es un sitio estático que habla directo con Supabase desde el
  navegador (mismo patrón que `robsen-salon`).
- **Backend:** Supabase — Postgres 17 + Auth + RLS real en cada tabla.
  Toda la autorización por rol vive en políticas RLS de Postgres, **no**
  en la aplicación (a diferencia del diseño Laravel original). Proyecto:
  "Erp carros" (`qiqowqakrarcqvxdiddm.supabase.co`).
- **Deploy:** GitHub Actions (`.github/workflows/deploy.yml`) build +
  `actions/deploy-pages` → GitHub Pages. Dispara en cada push a `main`.
  URL: `https://josaalv.github.io/erpcarros/`.
- **Routing:** `HashRouter` (no `BrowserRouter`) a propósito — evita el
  problema de rutas 404 en refresh que tiene GitHub Pages con rutas del
  lado del cliente sin configurar un fallback 404.html.

## Autenticación y bootstrap de administrador

- Supabase Auth con correo/contraseña. Tabla `perfil` (1:1 con
  `auth.users`, `id` = `auth.uid()`) guarda `nombre`, `rol`, `activo`.
- **La primera cuenta que se registra se vuelve `admin` automáticamente**
  vía el trigger `handle_new_user()` (`supabase/migrations/001_...sql`).
  Las siguientes entran como `gerencia` por default.
- Supabase pide confirmación de correo por default (`confirmation_sent_at`
  se llena al registrarse). Si el equipo quiere signups sin fricción,
  hay que desactivar "Confirm email" en Supabase Dashboard →
  Authentication → Sign In / Providers → Email — **no hay forma de
  cambiar ese ajuste vía SQL/MCP**, es config de la plataforma.

## Base de datos — decisiones que sí se preservaron del diseño original

- Importes en `numeric(12,2)`. Nunca `float`/`double`.
- Porcentajes en `numeric(7,4)` como fracción (0.2080 = 20.80%).
- El costo de adquisición (precio, comisión, impuestos, IVA) vive **solo**
  en `compra`, nunca como `gasto`. Ver vista `v_costo_vehiculo`.
- RN-12: `precio_minimo` nunca sale del rol `admin` — se redacta con
  `NULL` directo en la vista `v_vehiculo_ficha` (`case when es_admin()...`),
  no en el cliente.
- `es_demo` en las tablas operativas + policies RLS que exigen
  `es_demo = es_demo_actual()`: un registro real y uno de demo nunca se
  mezclan en una consulta, aplicado por Postgres, no por la app.

## Estado del esquema Supabase

`supabase/migrations/` tiene las migraciones ya aplicadas al proyecto real
(no hay pipeline automático de aplicación — se aplican a mano vía MCP de
Supabase o el SQL Editor, igual que en `robsen-salon`):

1. `001_esquema_inicial_y_rls.sql` — `perfil`, catálogos
   (`estado_proceso`, `ubicacion`, `categoria_gasto`), `socio`, `vehiculo`,
   `compra`, `gasto`, `aportacion`, vistas `v_costo_vehiculo` y
   `v_vehiculo_ficha`, RLS en todo.
2. `002_endurecer_permisos_funciones.sql` — revoca `EXECUTE` de `anon`
   sobre las funciones `es_admin()`/etc. (hallazgo de `get_advisors`).
3. `003_optimizaciones_indices_y_rls.sql` — índices de FK faltantes,
   `auth.uid()` envuelto en `(select ...)`, policies duplicadas
   colapsadas (hallazgos de `get_advisors` performance).
4. `004_semillas_catalogos_y_demo.sql` — catálogos completos + 5 unidades
   de demostración (`es_demo=true`) tomadas del prototipo de frontend.

**Ya verificado al peso dos veces** (MySQL y ahora Postgres): Mirage 2022
reproduce `costo_total = 142,580.00` vía `v_costo_vehiculo` en ambos
motores. Antes de cualquier cambio de esquema, corre
`get_advisors` (security) — es la convención de este desarrollador en
todos sus proyectos con Supabase.

## Qué falta (no asumir que ya existe)

- Pantallas construidas (`src/screens/`): Login/registro, Panel,
  Inventario, Expediente del vehículo (con edición de estado/ubicación),
  alta de vehículo, captura de gasto, administración de usuarios (admin
  cambia rol/activo de cada perfil — necesario porque todo el que se
  registra entra como `gerencia` por default). Faltan: Socios y
  liquidación, Documentación, Taller, Consignación, Portal de
  comisionista, Venta/cierre, Calculadora de puja — construir en ese
  orden aproximado (protege capital antes que comodidad, mismo criterio
  que el análisis original).
- Tablas del diseño original **todavía no migradas a Postgres**:
  `proveedor`, `comisionista`, `cliente`, `prospecto`, `orden_trabajo`,
  `documento`, `media`, `consignacion`, `venta`, `comision`,
  `cierre_financiero`, `liquidacion`, etc. Solo se tradujo el núcleo
  mínimo (vehículo, compra, gasto, socio, aportación) para tener algo
  funcional rápido — bastante lejos de las 46 tablas del diseño original.
- Sin pruebas automatizadas todavía (el diseño Laravel sí las tenía —
  `AutorizacionPermisosTest`/`CalculoFinancieroTest` — pero se
  descartaron con el resto del código PHP). Replicar el mismo espíritu
  con Postgres: pruebas negativas de RLS por rol.
- El workflow de deploy no corre migraciones de Supabase — esas se
  aplican a mano vía MCP, igual que en `robsen-salon`.

## Convenciones de este proyecto

- Todo el texto de UI en español (México).
- Reglas de negocio RN-01 a RN-30 siguen siendo la referencia para
  comportamiento esperado, aunque el mecanismo de aplicación cambió de
  "Policy de Laravel" a "policy de RLS".
- **Los permisos se validan en la base de datos (RLS), nunca solo
  ocultando un botón en la interfaz.** Un campo financiero que el rol no
  permite se redacta en la vista de Postgres, no en el componente React.
- Antes de cualquier cambio de esquema, correr `get_advisors` (security)
  después de aplicar la migración.
- Verificar en base real con transacciones de prueba cuando aplique, y
  guardar cada migración aplicada vía MCP también como archivo en
  `supabase/migrations/` — el MCP no lo hace solo.
- Cambios de código van por PR (confirmar con el usuario antes de push
  directo a `main`).
