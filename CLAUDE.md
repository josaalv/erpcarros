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
- **Site URL / Redirect URLs — mismo problema, otro rincón** (julio 2026):
  el enlace de "olvidé mi contraseña" mandaba a `localhost:3000` aunque
  `enviarRecuperacion()` en `auth.tsx` ya pasa `redirectTo:
  window.location.origin + window.location.pathname` correctamente.
  Causa: Supabase ignora el `redirectTo` si esa URL no está en la lista
  de "Redirect URLs" del dashboard y cae de vuelta al "Site URL" —
  ninguno de los dos se puede tocar por SQL/MCP, son config de plataforma
  (Authentication → URL Configuration). Arreglo de una sola vez: poner
  Site URL = `https://josaalv.github.io/erpcarros/` y agregar
  `https://josaalv.github.io/erpcarros/**` a Redirect URLs. Si un enlace
  de correo (confirmación, recuperación, invitación) manda a localhost,
  revisar esto primero antes de tocar código.

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
5. `005_esquema_completo_taller_comercial_cierre.sql` — el resto de las
   tablas del diseño original: `tipo_documento`, `documento`, `proveedor`,
   `subestado_taller`, `orden_trabajo`, `dano`, `subasta`,
   `evaluacion_puja`, `lote`, `consignacion`, `comisionista` (con
   `perfil_id` + función `mi_comisionista_id()`), `cliente`, `prospecto`,
   `interaccion`, `cita`, `oferta`, `apartado`, `venta`, `comision`,
   `cierre_financiero`, `reapertura`, `liquidacion`, vistas
   `v_participacion_socio` y `v_roi_segmento`, RLS completa en todo.
6. `006_semillas_taller_comercial_demo.sql` — semillas de demo para el
   esquema de la migración 005 (documentos, orden de trabajo, consignación,
   comisionista, clientes, prospecto).
7. `007_permitir_comisionista_ver_sus_clientes_referidos.sql` — política
   adicional en `cliente` para que un comisionista vea (solo lectura) los
   clientes que él mismo refirió vía `prospecto` — sin esto el portal de
   comisionista no podía mostrar nombre/teléfono del referido.
8. `008_login_picker_correo_perfil.sql` — columna `correo` en `perfil`
   (backfill desde `auth.users`, mantenida por `handle_new_user()`) y
   función `listar_perfiles_publicos()` (`security definer`, `grant` a
   `anon`) para el selector de perfiles del login — mismo patrón
   (vista → función SECURITY DEFINER) que `robsen-salon` adoptó tras su
   propia auditoría de seguridad; ver comentarios en el archivo.
9. (numeradas 009/010, ver archivos en `supabase/migrations/` para el
   detalle: subida de documentos + categorías personalizadas + checklist
   editable/borrable) y `011_permitir_eliminar_vehiculo.sql` — `ON DELETE
   CASCADE`/`SET NULL` en todos los FK hacia `vehiculo(id)` para poder
   borrar una unidad completa (ver sección "Qué falta" más abajo).
10. `012_ciclo_posibles_ofertas_y_publicacion.sql` — columnas nuevas para
    el ciclo de 4 etapas (ver sección dedicada más abajo): `version`,
    `kilometraje_llegada`, `torre`, `margen_deseado` en `evaluacion_puja`;
    `kilometraje_final`, `descripcion_breve`, `indicaciones_comisionista`,
    `comision_ofrecida` en `vehiculo`.
11. `013_exponer_campos_nuevos_en_vista_ficha.sql` — expone esas 4 columnas
    nuevas de `vehiculo` en `v_vehiculo_ficha` (sin redacción por rol,
    ninguna es tan sensible como `precio_minimo`/`costo_total`;
    `comision_ofrecida` es justo lo que el comisionista debe ver). Ojo si
    se vuelve a tocar esta vista: Postgres no deja reordenar/renombrar
    columnas de una vista existente con `CREATE OR REPLACE VIEW` — las
    columnas nuevas van siempre al final del `SELECT`, nunca intercaladas.

**Datos reales cargados (es_demo=false):** 19 unidades del negocio real
(V-1001 a V-1019) con su `compra`/`gasto` desglosado, tomadas de
`Informacion_cuentas.xlsx` que subió el usuario. **Esto se aplicó
directo a la base vía MCP, NUNCA como archivo de migración** — a
diferencia de los catálogos y semillas de demo, estas son cifras reales
del negocio y este repo es público. Si hace falta re-derivar o ajustar
estos datos, pídele el Excel al usuario de nuevo; no lo busques en el
repo ni lo commitees ahí. Nota: varias unidades donde el Excel mostraba
"Utilidad" ya calculada tenían errores de aritmética del propio Excel
(ej. March 2022 arrastraba un error de captura); se importó el desglose
de compra/gastos tal cual pero el cierre financiero (venta + utilidad
real) se dejó pendiente para que el admin lo cierre desde la pantalla
Ventas, que sí calcula bien contra `v_costo_vehiculo`.

**Ya verificado al peso dos veces** (MySQL y ahora Postgres): Mirage 2022
reproduce `costo_total = 142,580.00` vía `v_costo_vehiculo` en ambos
motores. Antes de cualquier cambio de esquema, corre
`get_advisors` (security) — es la convención de este desarrollador en
todos sus proyectos con Supabase.

## El ciclo de negocio completo (4 etapas)

El flujo que el dueño describió y que ya está construido de punta a punta:

1. **Posibles ofertas** (`src/screens/PosiblesOfertas.tsx`, admin-only —
   RLS `subasta_admin`/`evaluacion_admin`): pre-compra. Se registra una
   `subasta` (plataforma + fecha + lote/patio) y dentro de ella se
   capturan las unidades que interesa ofertar (`evaluacion_puja`): marca,
   modelo, año, versión, kilometraje de llegada (a veces viene alterado
   desde la subasta, se corrige después con `kilometraje_final`), torre,
   precio de mercado actual, presupuesto de reparación y margen deseado.
   La pantalla calcula en vivo el techo de puja (misma fórmula que
   `Calculadora.tsx`: `techo = precio_mercado − costo_reparación −
   comisión_subasta(5000) − margen_deseado×precio_mercado`) y el ROI
   proyectado contra el histórico de `v_roi_segmento` por banda de costo.
   Las evaluaciones se agrupan por marca y luego por torre, como pidió el
   usuario. Botón **"Adquirir"** (`AdquirirModal`): convierte una
   evaluación en unidad real — crea el `vehiculo` (estado `comprado`,
   ubicación `traslado`), crea la `compra` correspondiente, y marca la
   evaluación `resultado = 'ganada'` con `vehiculo_id` para no perder el
   vínculo. Este botón es el puente etapa 1 → etapa 2.
2. **Inventario / Taller** (ya existía, es "la parte más importante" según
   el usuario): documentación y gastos por fecha del vehículo ya
   adquirido. Al terminar la reparación se captura `kilometraje_final` en
   el Expediente (`EstadoEditor`, junto a estado comercial/documental) —
   corrige el de llegada sin sobreescribirlo.
3. **Publicación para venta** (dentro del Expediente, etapa 3): antes de
   publicar, sección **"Margen para decidir precio de venta"**
   (`MargenPublicacion`, admin-only) — se captura el precio de mercado
   actual (cambia después de la reparación, por eso no se reutiliza el de
   la evaluación de compra) y se compara en vivo contra `costo_total` ya
   cerrado para ver utilidad/margen antes de fijar `precio_autorizado`
   (ese campo se sigue editando desde "En venta", no aquí). Luego,
   **"Publicación para venta / información para comisionistas"**
   (`PublicacionForm`, admin/gerencia): `descripcion_breve`,
   `indicaciones_comisionista`, `comision_ofrecida` — estos 3 campos
   alimentan directo el catálogo del Portal de comisionista
   (`Comisionista.tsx`), que ahora solo muestra unidades que llegaron al
   umbral `listo` de `estado_proceso.orden` (mismo criterio que "En
   venta") y no están vendidas — antes de eso no tiene sentido que el
   comisionista la vea.
4. **Venta / Vendidos** (etapa final): **"Registrar venta" vive en "En
   venta" (`EnVenta.tsx`)**, no en `Ventas.tsx` — cada fila de unidad lista
   para vender tiene su botón, y `VentaModal` (exportado desde
   `Ventas.tsx` para que ambas pantallas lo reutilicen) crea el `venta` +
   `comision` (si aplica, con monto opcional ya en el mismo formulario).
   `Ventas.tsx` en cambio **solo muestra unidades que YA tienen una venta
   en curso** (cambiando su estado hacia vendido) — no las que están
   simplemente publicadas sin comprador; ahí vive `cerrarFinanciero`
   (calcula utilidad/margen/ROI reales contra `v_costo_vehiculo`, genera
   `liquidacion` por socio, marca `estado_comercial = 'vendido'`). En
   cuanto se marca vendida, la unidad sale de Inventario/En venta y
   aparece solo en **`src/screens/Vendidos.tsx`** — sección propia y
   separada de Inventario, con fecha de venta, canal, precio final,
   comisionista/comisión, y (admin) utilidad/margen/ROI del cierre.
   **Editable, no solo lectura** (RN de simetría agregar/editar): fecha,
   canal y precio de la venta (admin/gerencia, mismo permiso que
   `venta_update`) y monto/fecha de pago de la comisión (admin, mismo
   permiso que `comision_admin`) se corrigen ahí mismo con inputs
   `onBlur`, igual que en "En venta". Si el cierre financiero ya está
   cerrado y hace falta corregir el precio, el botón **"Recalcular
   cierre"** (admin) usa la tabla `reapertura` — ya existía en el esquema
   desde la migración 005 pero nunca se había usado desde el frontend —
   para dejar constancia del motivo, borra el `cierre_financiero`
   anterior (cascada a `liquidacion`) y genera uno nuevo (`estado:
   'reabierto'`) con los números recalculados contra el precio/canal ya
   corregidos.

**Bug preexistente encontrado y corregido de paso:** `cierre_financiero.cerrado_por`
es `not null references perfil(id)` sin default, pero `cerrarFinanciero()`
en `Ventas.tsx` nunca lo mandaba — cualquier intento de "Cerrar financiero"
debía estar fallando con violación de NOT NULL desde que se construyó esa
pantalla. Se corrigió mandando `session.user.id` (mismo patrón que ya se
necesitaba para el nuevo flujo de recalcular cierre).

**`Calculadora.tsx` quedó desactivada** (sin ruta ni nav, el archivo sigue
en `src/screens/`): `PosiblesOfertas.tsx` la reemplaza con el mismo
cálculo pero vinculado de verdad a una subasta real y a la compra que
genera — la calculadora vieja dejaba evaluaciones huérfanas (sin
`subasta_id`) y permitía marcar `resultado = 'ganada'` a mano sin crear
nunca el vehículo real.

## Orden del nav y borradores de formulario

- **Orden del nav** (`Layout.tsx`): Panel → Posibles ofertas (admin,
  primer paso del ciclo) → Inventario → En proceso/En venta/Ventas/Vendidos
  (admin/gerencia) → Socios/Usuarios (admin). Posibles ofertas va justo
  debajo de Panel a propósito, no junto a Socios/Usuarios — es la entrada
  al ciclo, no una pantalla administrativa secundaria.
- **Borradores de formulario en localStorage** (`src/lib/useBorrador.ts`):
  hook `useBorrador<T>(clave, inicial)` — misma forma que `useState` más
  una función `limpiar()` — que persiste el estado de un formulario en
  `localStorage` mientras se llena, para que no se pierda si el navegador
  descarta la pestaña en segundo plano (o el usuario tarda) antes de
  guardar. Aplicado a los formularios de captura más largos/críticos: alta
  de vehículo, captura de gasto, capital por socio, publicación para
  comisionistas, registrar venta, y todo el flujo de Posibles ofertas
  (subasta/evaluación/adquirir), Socios (socio/aportación) y referidos del
  portal de comisionista. La clave incluye el id del registro relacionado
  (vehículo, subasta, aportación, etc.) para que dos formularios distintos
  no compartan el mismo borrador. Se limpia SOLO al guardar con éxito —
  cancelar o cerrar el modal por accidente no borra el borrador, a
  propósito, porque perderlo ahí es exactamente el problema que se quiere
  evitar.

## Qué falta (no asumir que ya existe)

- Pantallas construidas (`src/screens/`): Login (selector de perfiles +
  registro + recuperar/restablecer contraseña), Mi cuenta (cambiar
  contraseña estando ya adentro), Panel, Posibles ofertas (etapa 1 del
  ciclo, ver sección dedicada arriba), Inventario (catálogo/búsqueda, solo
  unidades activas), Expediente del vehículo (estado comercial/documental
  + kilometraje final, checklist de documentación, margen de publicación,
  info para comisionistas), alta de vehículo, captura de gasto,
  administración de usuarios, En proceso, En venta, Vendidos (etapa 4,
  separada de Inventario), Socios y liquidación, Taller (kanban de órdenes
  de trabajo, desactivado), Consignación (lotes, desactivado), Portal de
  comisionista (Catálogo / Mis referidos / Mis comisiones), Ventas y
  cierre financiero (registrar venta → cerrar financiero → genera
  `liquidacion` por socio vía `v_participacion_socio`).
- **Login con selector de perfiles** (mismo patrón que `robsen-salon`):
  `Login.tsx` llama `supabase.rpc('listar_perfiles_publicos')` (anon, sin
  sesión) para mostrar tarjetas de las cuentas activas; al elegir una se
  pide solo la contraseña. `useAuth()` ahora expone `enviarRecuperacion`
  (`resetPasswordForEmail`) y `actualizarPassword` (`updateUser`), y un
  estado `passwordRecovery` que se activa con el evento
  `PASSWORD_RECOVERY` de Supabase. **Cuidado con `HashRouter`:** el enlace
  de recuperación deja un fragmento `#access_token=...&type=recovery` en
  la URL que no coincide con ninguna ruta — por eso `App.tsx` revisa
  `passwordRecovery` ANTES de intentar hacer match de rutas (`if
  (passwordRecovery) return <Login />`), si no la pantalla de "pon tu
  nueva contraseña" nunca llegaría a montarse.
- **No se pudo probar el flujo de login end-to-end en navegador en esta
  sesión** (Chromium en el sandbox no logra tunelizar HTTPS a través del
  proxy del agente — error conocido, documentado en `docs/DEPLOY.md`).
  Se verificó por separado: la función `listar_perfiles_publicos()`
  responde correctamente por `curl` directo, y la UI de cada paso
  (selector, registro) se revisó visualmente con Playwright sin red. Antes
  de dar el login por bueno del todo, probarlo en un navegador real.
- **`estado_proceso` y `ubicación` NO se piden en el alta** (`VehiculoNuevo`):
  una unidad se registra una sola vez, pero su etapa y ubicación cambian
  todo el tiempo mientras se prepara y se vende — pedirlas en el alta las
  deja obsoletas al día siguiente. El alta las arranca en un default fijo
  (clave `comprado` / `traslado`) y de ahí en adelante se administran para
  TODAS las unidades a la vez desde dos pantallas separadas por la etapa
  del catálogo `estado_proceso.orden` (umbral: la etapa `listo`):
  - `En proceso` (`src/screens/EnProceso.tsx`): unidades con
    `orden < listo` (evaluación → preparación) — edita `estado_proceso_id`
    y `ubicacion_id` en una tabla, una fila por unidad.
  - `En venta` (`src/screens/EnVenta.tsx`): unidades con `orden >= listo`
    y no `es_final` (listo/apartado/vendido) — edita `estado_comercial`,
    `ubicacion_id` y `precio_autorizado` (con `precio_minimo` solo visible
    para admin) en la misma tabla.
  El Expediente de cada unidad ya NO edita `estado_proceso`/`ubicación`
  (`EstadoEditor` solo toca `estado_comercial`/`estado_documental`) —
  evita tener el mismo campo editable en dos lugares sin sincronía.
- La lógica de cierre financiero y reparto de utilidad vive en el cliente
  (`src/screens/Ventas.tsx`, función `cerrarFinanciero`) porque no hay
  funciones/RPC de Postgres para eso todavía — está protegida solo por
  ser una pantalla admin-only + RLS de las tablas que toca (`venta`,
  `cierre_financiero`, `liquidacion`, `comision`), no por lógica en la
  base. Si se detecta que dos admins pueden cerrar la misma unidad dos
  veces (race condition), mover esto a una función `security definer` en
  Postgres.
- La calculadora de puja usa una fórmula propia razonable (techo = precio
  esperado − costo de reparación − comisión de subasta − utilidad
  objetivo) porque `docs/analisis-fuente/` con la fórmula original ya no
  está en el repo. Si el usuario da la fórmula exacta de RN-05, ajustar
  `src/screens/Calculadora.tsx`.
- Sin pruebas automatizadas todavía (el diseño Laravel sí las tenía —
  `AutorizacionPermisosTest`/`CalculoFinancieroTest` — pero se
  descartaron con el resto del código PHP). Replicar el mismo espíritu
  con Postgres: pruebas negativas de RLS por rol.
- El workflow de deploy no corre migraciones de Supabase — esas se
  aplican a mano vía MCP, igual que en `robsen-salon`.
- **Taller y Consignación están desactivadas a propósito** (quitadas de
  `Layout.tsx` y de las rutas en `App.tsx`, hasta que se defina qué deben
  hacer esas pantallas). El código de `src/screens/Taller.tsx` y
  `Consignacion.tsx` sigue intacto — reactivar es solo devolver el import,
  la ruta y la línea de nav.
  **Plan que dio el usuario para cuando se retome** (todavía sin
  construir, no adivinar la implementación sin confirmar primero):
  Consignación deja de ser un ítem de nav independiente — pasa a ser un
  submenú/sección DENTRO de "En venta". La idea completa: "En venta"
  agrupa todas las unidades listas para vender, y dentro de ahí se
  distinguen por dónde están físicamente — "en taller" (ubicación propia)
  o "en consignación" (en un lote externo). La sección de consignación
  necesita mostrar la info completa del lote (ya existe la tabla `lote`:
  nombre, contacto, teléfono — ver `Consignacion.tsx` ya construido para
  reutilizar esa parte). Osea: `En venta` = vista general, con dos
  subvistas o filtros por ubicación (taller / consignación), no dos
  pantallas separadas sin relación.
- **Inventario solo muestra unidades activas** (`estado_comercial !=
  'vendido'`, `src/screens/Inventario.tsx`) — antes tenía pestañas
  "Unidades activas"/"Unidades vendidas" dentro de la misma pantalla, pero
  con el ciclo de 4 etapas las vendidas se extrajeron a su propia sección
  (`Vendidos.tsx`, ver sección del ciclo arriba) para que quedaran
  realmente separadas de Inventario, no solo en una pestaña.
- **Documentación** (dentro del Expediente) ya sube el archivo real, no
  solo el estado: bucket privado de Storage `documentos-vehiculo`
  (políticas RLS: solo `es_admin_o_gerencia()`, igual que la tabla
  `documento`), columna `documento.archivo_path`. También se pueden crear
  categorías propias (`tipo_documento.es_personalizado = true`) desde la
  misma pantalla, y borrarlas — el FK de `documento.tipo_documento_id`
  bloquea el borrado solo si ya tiene un archivo (no hace falta lógica
  extra para no dejar archivos huérfanos). Las 8 categorías originales del
  checklist obligatorio no se pueden borrar desde la UI (RN-11).
- **Se puede eliminar una unidad completa** (migración
  `011_permitir_eliminar_vehiculo.sql`): antes ningún FK de `vehiculo_id`
  tenía `ON DELETE`, así que Postgres rechazaba el borrado en cuanto
  existía una sola fila dependiente — es decir, siempre. Ahora
  compra/gasto/aportacion/documento/consignacion/venta/
  cierre_financiero/liquidacion/etc. cascadean (se van con la unidad);
  `evaluacion_puja`/`cita`/`prospecto`/`venta.veh_tomado_id` quedan en
  `SET NULL` porque esos registros siguen siendo válidos sin esa unidad
  puntual. El botón vive en `Expediente.tsx` (`EliminarUnidad`,
  admin-only) y pide escribir el `id_interno` exacto para confirmar —
  primero borra los archivos de Storage de sus `documento` (Postgres no
  los conoce), luego el `vehiculo` (la cascada hace el resto).
- **"En venta" solo debe mostrar unidades que se están vendiendo, no las
  ya vendidas** — el filtro ahora excluye explícitamente
  `estado_comercial === 'vendido'` además del criterio de
  `estado_proceso.orden`. Una vez que una unidad se marca vendida
  desaparece de "En venta" y solo aparece en la pestaña "Unidades
  vendidas" de Inventario.
- **Socios y aportaciones son editables/borrables**, no solo se pueden
  crear (`Socios.tsx`): cada socio tiene botones editar/eliminar y una
  casilla de activo; cada aportación igual. El FK de
  `aportacion`/`liquidacion` hacia `socio` protege el borrado de un socio
  con historial.
- **Capital de socios asignado por unidad, visible en el Expediente**
  (sección "Capital / Socios", solo admin): antes la única forma de ver
  qué socio puso dinero en qué carro era ir a la pantalla Socios y cruzar
  manualmente — ahora se ve y se edita directo en la ficha del vehículo,
  con el % de participación calculado ahí mismo, para que quede explícito
  de quién es el capital de cada unidad y no se mezcle entre socios.

## Convenciones de este proyecto

- Todo el texto de UI en español (México).
- Reglas de negocio RN-01 a RN-30 siguen siendo la referencia para
  comportamiento esperado, aunque el mecanismo de aplicación cambió de
  "Policy de Laravel" a "policy de RLS".
- **Los permisos se validan en la base de datos (RLS), nunca solo
  ocultando un botón en la interfaz.** Un campo financiero que el rol no
  permite se redacta en la vista de Postgres, no en el componente React.
- **Simetría agregar/quitar (base de cualquier ERP):** si una pantalla
  permite crear algo (categoría, registro, archivo), tiene que permitir
  también editarlo o borrarlo — no construir flujos de solo-alta. Cuando
  el borrado pueda romper una referencia (ej. una categoría con
  documentos ligados), apoyarse en el FK de la base en vez de escribir
  lógica de validación a mano — es más simple y no se puede olvidar
  actualizar en un solo lugar.
- **Compatibilidad de caracteres:** todo el contenido es español con
  acentos/ñ — al generar identificadores derivados de texto libre (ej. la
  `clave` de una categoría personalizada a partir de su nombre), usar
  `normalize('NFD')` + quitar el bloque Unicode de marcas diacríticas
  combinantes (puntos de código U+0300 a U+036F) por su valor hexadecimal
  en la expresión regular, nunca pegando acentos sueltos como texto
  literal en el código fuente — es frágil ante problemas de encoding (ver
  `src/screens/Expediente.tsx`, función `crearCategoria`, para el patrón
  correcto ya aplicado).
- Antes de cualquier cambio de esquema, correr `get_advisors` (security)
  después de aplicar la migración.
- Verificar en base real con transacciones de prueba cuando aplique, y
  guardar cada migración aplicada vía MCP también como archivo en
  `supabase/migrations/` — el MCP no lo hace solo, salvo datos reales de
  negocio (ver nota de arriba): esos nunca van al repo público.
- Cambios de código van por PR (confirmar con el usuario antes de push
  directo a `main`).
