# ERP Vehículos — guía operativa para Claude

ERP para compra (subasta Prosubastas) → reparación → venta de vehículos, ~6
usuarios, volumen que fluctúa mucho: listas con búsqueda/filtros, acciones
masivas y operaciones atómicas en la base. Todo el texto de UI en español (MX).

**Este archivo es corto a propósito** (se carga en cada mensaje). El detalle
completo de cada módulo, migración y decisión está en
`docs/HISTORIAL_DISENO.md`: búscalo con `grep -n` **solo cuando lo necesites**
y agrega ahí las decisiones nuevas (aquí solo un resumen de una línea).

## Stack
- React 19 + TS + Vite, `HashRouter`, sitio estático en GitHub Pages
  (`https://josaalv.github.io/erpcarros/`, deploy en cada push a `main`).
- Supabase "Erp carros" (`qiqowqakrarcqvxdiddm`): Postgres 17 + Auth + RLS
  + Storage (`documentos-vehiculo`) + Edge Function `prosubastas`.
- Migraciones en `supabase/migrations/` (001…025) se aplican a mano por MCP;
  guardar cada una también como archivo. Después: `get_advisors` (security)
  y `supabase/tests/rls_por_rol.sql` (debe dar `OK`).

## Reglas que no se rompen
- **Repo público**: nunca commitear datos reales (cifras, Excel, PDFs,
  contratos, listados, chats). Datos reales solo directo a la base por MCP.
- Permisos en RLS, nunca solo ocultando botones. `precio_minimo` solo admin
  (vista + `precio_minimo_de()`); `vehiculo` tiene SELECT por columna: toda
  columna nueva necesita `grant select (col) on public.vehiculo to
  authenticated` y nunca `select *` sobre `vehiculo`.
- Importes `numeric(12,2)`, porcentajes `numeric(7,4)` fracción. Costo de
  adquisición solo en `compra`, nunca como `gasto`.
- `es_demo` separa real/demo por RLS.
- MCP de Supabase: cualquier SQL con "delete"/"drop" (incluso "dropbox") se
  traba sin aplicar → evitarlo; bajas desde la app o archivos `*b_*.sql`
  que el usuario pega en el SQL Editor.
- Vistas: columnas nuevas siempre al final del SELECT.
- Simetría crear/editar/borrar en todo; apoyarse en FKs.
- UI: clases de `src/index.css` y componentes de `src/components/Ui.tsx`,
  sin estilos inline nuevos; nunca mostrar claves crudas (mapas en
  `src/lib/helpers.ts`, fechas con `fecha()`).
- Identificadores desde texto: `normalize('NFD')` + quitar U+0300–U+036F
  por código hex.
- Cambios por PR (el usuario acepta crear + fusionar). Probar con `tsc`,
  lint, build y Playwright con Supabase/Dropbox simulados.
- Hora del usuario: Guadalajara (America/Mexico_City). Al programar algo,
  calcular "mañana" en su hora, no en UTC.

## Mapa del ciclo (detalle en el historial)
1. **Subastas** (`Subastas.tsx`): importa listados de Prosubastas por enlace
   (un PDF trae todo su patio; usa el listado final, no `1er/`/`2do/`),
   catálogo histórico `subasta_unidad`, fotos por Dropbox ("Ligar fotos").
   Dropbox en `src/lib/dropbox.ts`; si la carpeta tiene descargas
   desactivadas (GDL) se usa el visor incrustado (`dropboxEmbed.ts`).
2. **Posibles ofertas**: "Me interesa" → evaluación, techo de puja,
   "Adquirir" → `vehiculo` + `compra`.
3. **Inventario / En proceso / En venta / Expediente**: gastos, documentos,
   socios, fotos, publicación para comisionistas.
4. **Ventas / Vendidos**: venta, cierre financiero en base
   (`cerrar_financiero`, `recalcular_cierre`), por cobrar / por pagar.
- Desactivadas a propósito: Taller, Consignación, Calculadora.

## Diseño en curso (sin construir)
- **Resultados de subasta**: leer el chat de Zoom (app de escritorio) pegado
  o guardado (.txt) y registrar por torre base / puja / resultado (venta,
  reserva, pass). Falta un ejemplo real del chat y confirmar si Zoom deja
  guardarlo.
- **Cargar contratos**: un PDF por marca con las ganadas; alta masiva
  (vehículo + compra + contrato), cruce por stock/serie con la evaluación.
- Socios (capital central, reparto después), carga de históricos y
  Taller/Consignación: pendientes de definir con el usuario.
