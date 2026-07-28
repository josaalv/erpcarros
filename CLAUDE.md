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

## Qué falta (no asumir que ya existe)

- Pantallas construidas (`src/screens/`): Login (selector de perfiles +
  registro + recuperar/restablecer contraseña), Mi cuenta (cambiar
  contraseña estando ya adentro), Panel, Inventario (catálogo/búsqueda),
  Expediente del vehículo (estado comercial/documental, checklist de
  documentación), alta de vehículo, captura de gasto, administración de
  usuarios, En proceso, En venta, Socios y liquidación, Taller (kanban de
  órdenes de trabajo), Consignación (lotes), Portal de comisionista
  (Catálogo / Mis referidos / Mis comisiones), Ventas y cierre financiero
  (registrar venta → cerrar financiero → genera `liquidacion` por socio
  vía `v_participacion_socio`), Calculadora de puja (techo de puja + ROI
  proyectado contra `v_roi_segmento`).
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
- **Inventario** tiene dos secciones (`Unidades activas` / `Unidades
  vendidas`, `src/screens/Inventario.tsx`), separadas por
  `estado_comercial = 'vendido'` — no por `estado_proceso`, para que
  coincida con el mismo criterio que ya usa "En venta"/cierre financiero.
- **Documentación** (dentro del Expediente) ya sube el archivo real, no
  solo el estado: bucket privado de Storage `documentos-vehiculo`
  (políticas RLS: solo `es_admin_o_gerencia()`, igual que la tabla
  `documento`), columna `documento.archivo_path`. También se pueden crear
  categorías propias (`tipo_documento.es_personalizado = true`) desde la
  misma pantalla, y borrarlas — el FK de `documento.tipo_documento_id`
  bloquea el borrado solo si ya tiene un archivo (no hace falta lógica
  extra para no dejar archivos huérfanos). Las 8 categorías originales del
  checklist obligatorio no se pueden borrar desde la UI (RN-11).

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
