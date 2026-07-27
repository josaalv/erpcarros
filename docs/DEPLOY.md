# Despliegue — ERP Vehículos

**Nota:** este documento reemplaza una versión anterior escrita para
Laravel + Hostinger. Ese plan se abandonó a mitad de la construcción — ver
la sección "Historial de arquitectura" en `CLAUDE.md` antes de asumir que
algo de Hostinger sigue aplicando.

## Cómo funciona hoy

1. `git push` a `main` dispara `.github/workflows/deploy.yml`.
2. `npm ci && npm run build` compila el frontend (React + Vite) con
   `GITHUB_PAGES=true`, que hace que `vite.config.ts` use
   `base: '/erpcarros/'` en vez de `/` (necesario porque GitHub Pages de
   un repo de usuario sirve desde ese subpath).
3. Las variables `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` se toman
   de `.env.production`, **committeado al repo** — no son secreto: la
   anon key de Supabase está diseñada para vivir en el cliente, la
   protege RLS, no la oscuridad. Si algún día se necesita la
   `service_role` key (nunca en el frontend), esa sí va a GitHub Secrets.
4. `actions/upload-pages-artifact` + `actions/deploy-pages` publican
   `./dist` a GitHub Pages.
5. URL pública: **https://josaalv.github.io/erpcarros/**

No hace falta ninguna cuenta de Hostinger, FTP, ni verificación manual de
ruta para este flujo — a diferencia de `robsen-salon`, GitHub Pages no
tiene el problema de "conector que reporta éxito pero escribe en el lugar
equivocado" porque es la propia GitHub la que sirve los archivos.

## Primera vez / si Pages no aparece activo

`actions/deploy-pages` normalmente activa Pages solo en el primer run
exitoso. Si el workflow corre pero la URL da 404:

1. Ve a Settings → Pages del repo en GitHub.
2. En "Build and deployment" → Source, confirma que dice **"GitHub
   Actions"** (no "Deploy from a branch"). Si no, cámbialo — es un toggle
   de un clic, no requiere tocar el workflow.
3. Vuelve a correr el workflow (push vacío o `workflow_dispatch` desde la
   pestaña Actions).

## Base de datos (Supabase)

- Proyecto: **"Erp carros"** (`qiqowqakrarcqvxdiddm.supabase.co`), Postgres 17.
- RLS real en todas las tablas, sin acceso abierto por `anon` key —
  mismo estándar que `robsen-salon`.
- Migraciones en `supabase/migrations/`, en orden — se aplican vía MCP de
  Supabase (`apply_migration`) o el SQL Editor. No hay pipeline
  automático que las corra en el deploy: si agregas una migración nueva,
  aplícala a mano contra el proyecto antes o después de subir el código
  que la usa, y guarda el archivo `.sql` en el repo para que quede
  registrado (el MCP no lo hace solo).
- Corre `get_advisors` (security y performance) después de cada
  migración — ya encontró y se corrigieron problemas reales en
  `002_endurecer_permisos_funciones.sql` y
  `003_optimizaciones_indices_y_rls.sql`.

### Confirmación de correo en signups

Por default, Supabase Auth exige confirmar el correo antes de poder
iniciar sesión. Para un equipo interno de 6 personas esto puede ser
fricción innecesaria. Para desactivarlo: Supabase Dashboard →
Authentication → Sign In / Providers → Email → desmarcar "Confirm email".
Es un ajuste de la plataforma, no se puede cambiar por SQL/MCP.

## Verificación de cálculo financiero

Antes de dar por bueno un cambio al esquema, reproduce el caso Mirage
2022 contra la vista `v_costo_vehiculo` y compara al peso:

| Unidad      | costo_total | utilidad  | margen |
|-------------|------------:|----------:|-------:|
| Mirage 2022 |  142,580.00 | 37,420.00 | 0.2079 |

Ya verificado en este proyecto de Supabase (`select ... from
v_costo_vehiculo cv join vehiculo v on v.id=cv.vehiculo_id where
v.id_interno='V-0142'`) — coincide exacto. Pendiente: Jetta 2018 e Hilux
diésel 2020 (con reparto a dos socios) como casos de prueba adicionales.

## Desarrollo local

```bash
npm install
cp .env.example .env
# Rellena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

**Nota sobre pruebas en sandbox:** si corres esto dentro de un entorno con
proxy de red restrictivo (como el sandbox de Claude Code), el navegador
headless puede no respetar `HTTPS_PROXY` automáticamente y las llamadas a
Supabase se quedan colgadas sin error visible — no es un bug de la app.
En un navegador real de usuario (sin proxy corporativo) esto no aplica.
