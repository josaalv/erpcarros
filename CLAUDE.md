# ERP Vehículos — guía operativa para Claude

ERP para un negocio de compra, reparación y venta de vehículos (arbitraje
de activos con valor agregado: subasta → taller → venta, ciclo ~30 días,
12 unidades activas, 6 usuarios). Este archivo es memoria persistente: se
lee automáticamente al abrir el repo.

**Antes de asumir cómo funciona algo, consulta `docs/`:**

- `docs/analisis-fuente/03-analisis-reglas-permisos.txt` — el documento
  completo de análisis: hallazgos del negocio real, 30 reglas de negocio
  (RN-01 a RN-30), matriz de permisos por rol, mapa de procesos, MVP y
  fases, criterios de aceptación, plan de pruebas. **Es la fuente de
  verdad de qué debe hacer el sistema.**
- `docs/analisis-fuente/01-esquema-base-datos.txt` — el esquema MySQL
  completo tal como se implementó: las 46 tablas, vistas, triggers,
  semillas y el orden obligatorio de migraciones. Ya está implementado en
  `database/migrations/` — si necesitas el diseño original, está aquí.
- `docs/analisis-fuente/02-interfaz-frontend-prototipo.jsx` — el
  prototipo navegable de frontend (React, 4 roles) que define el contrato
  de UI: qué campos, qué filtros, qué ve cada rol. Úsalo como referencia
  de UX al construir pantallas reales, no lo copies literal (es un mock
  con datos ficticios y estilos inline).
- `docs/DEPLOY.md` — flujo de despliegue a Hostinger, checklist pendiente,
  y riesgos ya identificados (ver abajo).
- `docs/kit-aterrizaje-referencia.md` — el kit genérico de arranque para
  proyectos tipo CRM/ERP de este mismo desarrollador, con el playbook de
  diagnóstico FTP aprendido en `robsen-salon`. Nota: ese kit asume PHP
  puro por defecto, pero **este proyecto específico usa Laravel +
  Filament** — decisión ya tomada y justificada en el análisis (ver
  Tabla 4 de `03-analisis-reglas-permisos.txt`), no un olvido.

## Stack

- **Backend:** Laravel 13 (PHP 8.3+), plantillas de servidor +
  interacciones ligeras (Livewire vía Filament).
- **Panel administrativo:** Filament 3 — listados, filtros, formularios
  sin construirlos desde cero. Ya instalado en `app/Providers/Filament/AdminPanelProvider.php`,
  panel accesible en `/admin`. Faltan los `Resource` de cada entidad.
- **Base de datos:** MySQL 8 en Hostinger (única base viva; ver
  `docs/DEPLOY.md` para el esquema de respaldo). **No hay permisos a nivel
  de base de datos** (a diferencia de Supabase/RLS): toda autorización por
  rol vive en la aplicación. Esto es una decisión consciente documentada
  en el análisis, con el costo explícito de que las pruebas negativas de
  permisos son obligatorias, no opcionales (ver R10 y §17 del análisis).
- **Autenticación:** modelo `App\Models\Usuario` sobre la tabla `usuario`
  (no `users` de Laravel) — columnas en español (`correo`,
  `password_hash`) según el esquema. `config/auth.php` ya apunta el
  provider `users` a este modelo.
- **Deploy:** GitHub Actions + `lftp mirror --reverse` a Hostinger, mismo
  mecanismo verificado en `robsen-salon`. Ver `docs/DEPLOY.md` — **todavía
  no está activo** (dispara manual hasta completar el checklist).

## Base de datos — decisiones no negociables (del esquema original)

- Importes en `DECIMAL(12,2)`. Nunca `FLOAT` ni `DOUBLE`.
- Porcentajes en `DECIMAL(7,4)`, como fracción (0.2080 = 20.80%).
- Ningún total calculable se almacena, salvo en `cierre_financiero` (se
  congela a propósito tras el cierre).
- El costo de adquisición (precio, comisión, impuestos, IVA) vive **solo**
  en `compra`, nunca como `gasto`. Ver `v_costo_vehiculo`.
- Nada se borra físicamente: borrado lógico (`deleted_at`, `deleted_by`,
  `delete_motivo`) en toda tabla operativa — helper
  `App\Support\SchemaHelpers::bloqueEstandar()` en las migraciones.
- `es_demo` en toda tabla operativa: el perfil de demostración vive en el
  mismo sistema con datos sembrados y escritura bloqueada en el servidor,
  nunca en un entorno separado.
- Los 4 catálogos (`estado_proceso`, `ubicacion`, `categoria_gasto`,
  `tipo_documento`) son tablas, no `ENUM`: se configuran sin migración.
- Los tres precios de un vehículo están separados: `precio_minimo`
  (**solo admin, nunca sale de ese rol**), `precio_autorizado` (venta
  directa) y `precio_lote` (asignado a consignación). No los confundas.

## Estado del esquema

Las migraciones en `database/migrations/` ya implementan el esquema
completo (46 tablas + 4 vistas derivadas + 4 triggers de protección de
cierre financiero), en el orden obligatorio de §11 del documento fuente.
Verificado contra MySQL 8.0.46 real en este entorno de desarrollo — no
contra SQLite ni MariaDB (el esquema usa `utf8mb4_0900_ai_ci`, `CHECK` y
funciones de ventana que no son fieles en otros motores).

**Ya verificado al peso:** el caso Mirage 2022 (`costo_total = 142,580.00`,
`utilidad = 37,420.00`, `margen = 0.2079`) — ahora automatizado en
`tests/Feature/CalculoFinancieroTest.php`, no solo probado a mano.
**Pendiente:** Jetta 2018 e Hilux diésel 2020 (esta con reparto a dos
socios) como casos de prueba adicionales — no des por bueno un cambio de
esquema sin correr `php artisan test`, es la prueba más barata del
proyecto (ver `docs/DEPLOY.md`).

**Riesgo conocido sin resolver:** crear los triggers localmente requirió
`SET GLOBAL log_bin_trust_function_creators = 1` porque MySQL exige
privilegio `SUPER` para crear triggers con binlog activado. No se ha
confirmado si el usuario de MySQL en Hostinger va a tener ese privilegio o
esa variable ajustada — ver `docs/DEPLOY.md`.

## Capa de autorización (ya implementada)

- `permiso` y `rol_permiso` **ya están sembrados** por `PermisoSeeder`,
  traduciendo la Tabla 2 (matriz de acceso) del análisis. El rol `admin`
  NO tiene filas ahí a propósito — `Usuario::ambitoPara()` responde
  `'todos'` para admin sin consultar la tabla (bypass explícito,
  documentado en el propio método).
- `Usuario::ambitoPara($recurso, $accion)` devuelve `'todos'` /
  `'propios'` / `'ninguno'` consultando `rol_permiso`. `Usuario::puede()`
  y `Usuario::soloPropios()` son atajos sobre ese método.
- `Usuario::vePrecioMinimo()` y `Usuario::veCifrasFinancieras()` resuelven
  la redacción de **campos** (RN-12, fila "Costo acumulado, utilidad,
  margen" de la Tabla 2) — esto es independiente del ámbito por fila:
  un campo financiero se oculta aunque el usuario sí pueda ver la fila.
- `App\Models\Concerns\TieneBloqueEstandar` (usado por casi todos los
  modelos operativos) aplica `EsDemoScope` automáticamente y **lanza
  `RuntimeException` si el rol `demo` intenta escribir** (CA-14), como
  segunda capa además de las Policies. **Excepción a propósito:**
  `Usuario` NO usa este trait (riesgo de recursión vía `Auth::user()`
  durante la propia autenticación — ver el comentario en el modelo).
- Policies ya construidas como patrón de referencia:
  `VehiculoPolicy`, `GastoPolicy` (ámbito simple), `ProspectoPolicy`,
  `ComisionPolicy` (ámbito `'propios'` real, contra `comisionista_id`).
  **Faltan las del resto de recursos** — replica el mismo patrón
  (`$usuario->ambitoPara($recurso, $accion)` + `match` sobre
  `todos`/`propios`/`ninguno`), no reinventes el mecanismo.
- `tests/Feature/AutorizacionPermisosTest.php` automatiza las pruebas
  negativas más críticas de §17 (gerencia sin costos, comisionista sin
  precio mínimo ni prospectos ajenos, demo sin escritura, usuario
  desactivado sin permisos, admin con acceso total). **Ejecuta este
  archivo después de cualquier cambio a permisos/roles** —
  `php artisan test --filter=AutorizacionPermisosTest`.

## Qué falta (no asumir que ya existe)

- Ningún `Filament\Resource` está construido todavía. El orden recomendado
  de construcción está en §18 del documento de análisis: sesión/roles →
  vehículo/expediente → gastos con foto → socios/liquidación →
  documentación → taller/proveedores → consignación/portal comisionista →
  venta/cierre → calculadora de puja (al final, necesita histórico de
  ROI) → paneles/demo/respaldos. Cuando construyas los Resources, la
  redacción de campos financieros (`vePrecioMinimo()`,
  `veCifrasFinancieras()`) debe aplicarse ahí con `visible()`/`hidden()`
  a nivel de servidor (Filament evalúa esas closures en el backend, no
  en el navegador) — nunca ocultar solo con CSS/JS.
- Servicios de dominio pendientes (mencionados como comentario en los
  modelos correspondientes): `VentaService` (RN-19, toma a cuenta genera
  unidad nueva), `CierreService` (RN-08, RN-20, RN-21: validar gastos
  pendientes antes de liquidar, congelar cierre, manejar reapertura).
  `App\Services\GastoService` ya existe como ejemplo del patrón (RN-01,
  gasto + aportación en una sola transacción cuando paga un socio).
- Tareas programadas pendientes: liberar apartados vencidos a 30 días
  (RN-17) y liberar atribución de prospecto a 15 días (RN-13) — hoy no
  hay ningún `Schedule::` configurado.
- El workflow de deploy existe pero no corre migraciones contra Hostinger
  todavía (falta decidir SSH vs. manual — ver `docs/DEPLOY.md`).
- `ext-bcmath` es requerido (`composer.json` ya lo declara) — confirma que
  el hosting de Hostinger lo trae habilitado antes de desplegar.

## Convenciones de este proyecto

- Todo el texto de UI en español (México).
- Reglas de negocio RN-01 a RN-30: no las reinventes, ya están numeradas
  en el análisis — referencia la regla por su ID en commits/PRs cuando
  aplique.
- **Los permisos se validan en el servidor, nunca solo ocultando un botón
  en la interfaz** (regla de oro del análisis, §6). Un campo financiero
  que el rol no permite ni debe llegar en la respuesta al cliente.
- Verificar en base real (MySQL) con transacciones de prueba
  (`BEGIN`/`ROLLBACK`) antes de dar un fix por bueno, igual que en
  `robsen-salon`.
- Cambios de código van por PR (confirmar con el usuario antes de push
  directo a `main`).
