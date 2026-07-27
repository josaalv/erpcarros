# Kit de aterrizaje — nuevos sistemas tipo CRM/ERP para negocios

Basado en lo aprendido construyendo y desplegando **Robsen Salón & Spa**
(`josaalv/robsen-salon`). Este documento es el **primer mensaje** que se
manda a una sesión nueva de Claude Code cada vez que arranca un proyecto
para un negocio distinto. Sustituye los `[CORCHETES]` por los datos del
proyecto específico antes de enviarlo.

---

## Cómo se usa este kit (flujo de 3 mensajes)

1. **Este documento** — entrena a la sesión con el stack estándar, las
   reglas de seguridad y el playbook de deploy, antes de que exista una
   sola línea de código del proyecto nuevo.
2. **El archivo de frontend** (viene de Claude Design) — se manda después,
   ya con el visual/UX resuelto. La sesión de código lo usa como base y
   construye el backend alrededor.
3. **Orden de deploy** — se pide al final, cuando frontend + backend ya
   funcionan localmente.

---

## Stack estándar para estos proyectos

- **Frontend:** el que entregue Claude Design (normalmente React/Vite +
  TypeScript, puede variar). Se compila a archivos estáticos.
- **Backend:** **API propia en PHP**, corriendo nativo en el hosting
  compartido de Hostinger (no requiere Node/Python como proceso
  persistente — PHP se ejecuta por request vía Apache/LiteSpeed, es lo que
  el hosting compartido ya trae de fábrica).
- **Base de datos:** **MySQL de Hostinger** (la que se crea desde hPanel →
  Bases de datos), consultada desde PHP con PDO. **No usamos Supabase en
  estos proyectos** — es una decisión explícita, no un olvido.
- **Deploy:** GitHub Actions compila el frontend y sube todo (frontend +
  API en PHP) por FTP a Hostinger con `lftp mirror --reverse`. Mismo
  mecanismo ya probado y funcionando en `robsen-salon`.

### Por qué PHP y no Node/Python para el backend

Hostinger compartido no sostiene de forma confiable un proceso de
Node/Python corriendo indefinidamente (salvo un plan que explícitamente
incluya "Node.js hosting", y aun así es más fricción). PHP evita ese
problema por completo: no hay proceso que mantener vivo, cada request lo
atiende el propio servidor web. Si en algún proyecto específico hace falta
Node/Python de verdad (por una librería, por ejemplo), es una decisión
consciente que hay que tomar aparte — no el default.

---

## Arquitectura de datos y seguridad (reemplazo de lo que hacía Supabase)

Supabase nos daba gratis: autenticación, RLS (seguridad a nivel de fila) y
una API REST generada sola. Al usar MySQL de Hostinger directo, **eso hay
que construirlo a mano en PHP** — es la parte donde más cuidado hay que
tener:

1. **Nunca concatenar SQL con datos del usuario.** Siempre *prepared
   statements* con PDO (`$pdo->prepare(...)` + bind de parámetros). Cero
   excepciones a esta regla.
2. **Autenticación propia:** sesiones de PHP (`session_start()` +
   cookie httpOnly/secure) o JWT si el frontend lo prefiere.
   Contraseñas siempre con `password_hash()` / `password_verify()` —
   nunca texto plano ni hash casero.
3. **Autorización por rol en cada endpoint**, explícita — como no hay RLS
   automático, cada archivo PHP que toca datos sensibles debe revisar
   "¿este usuario/rol puede hacer esto?" antes de tocar la base. Documentar
   qué rol puede qué, igual que hacíamos con las políticas RLS de
   Supabase, pero ahora como código PHP explícito al inicio de cada
   endpoint.
4. **CORS:** si la API y el frontend viven en el mismo dominio (lo normal
   en este esquema, mismo `public_html`), no hace falta configurar CORS.
   Si en algún proyecto quedan en dominios distintos, hay que resolverlo
   explícitamente.
5. **Credenciales de base de datos:** nunca en el repo. Van en un archivo
   de configuración fuera del control de versiones en el servidor
   (`config.php` con `.gitignore`, o variables inyectadas en el deploy),
   igual de estricto que tratábamos los secrets de Supabase.
6. **Backups:** MySQL de Hostinger no se respalda solo de forma
   automática como Supabase — hay que armar un `mysqldump` programado
   (cron job de Hostinger o GitHub Actions con acceso a la base) desde el
   día uno del proyecto, no como algo "para después".

---

## Flujo de deploy — paso a paso

Basado exactamente en cómo quedó `robsen-salon/.github/workflows/deploy.yml`
tras resolver el incidente de julio 2026 (ver sección de lecciones
aprendidas abajo).

```yaml
# .github/workflows/deploy.yml (plantilla)
name: Deploy a Hostinger

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm install
      - run: npm run build   # genera ./dist/ (frontend estático)

      - name: Instalar lftp
        run: sudo apt-get update -qq && sudo apt-get install -y -qq lftp

      - name: Subir a Hostinger por FTP (lftp mirror)
        env:
          FTP_SERVER: ${{ secrets.HOSTINGER_FTP_SERVER }}
          FTP_USER: ${{ secrets.HOSTINGER_FTP_USERNAME }}
          FTP_PASS: ${{ secrets.HOSTINGER_FTP_PASSWORD }}
        run: |
          lftp -u "$FTP_USER,$FTP_PASS" "$FTP_SERVER" <<'EOF'
          set ssl:verify-certificate no
          set ftp:ssl-allow no
          set net:timeout 20
          set net:max-retries 2
          mirror --reverse --verbose ./dist/ ./
          bye
          EOF
```

Si el proyecto tiene backend en PHP, el `dist/` a subir incluye tanto el
build del frontend como la carpeta de la API en PHP (por ejemplo,
`dist/api/*.php`), o se suben en el mismo paso con dos `mirror` distintos
si viven en carpetas separadas del repo.

### ⚠️ Antes de automatizar nada — verificación manual obligatoria

**Esto es lo que nos costó horas la última vez.** Un conector puede
reportar "deploy exitoso" y escribir en un directorio que **no** es el que
sirve el sitio, sin ningún error visible. No vuelvas a confiar ciegamente
en el checkmark verde.

1. Crea la cuenta FTP dedicada para el dominio del proyecto en Hostinger.
2. Con las credenciales exactas que va a usar el deploy, conecta con
   `lftp` a mano (no todavía por GitHub Actions):
   ```
   lftp -u usuario,contraseña servidor
   set ssl:verify-certificate no
   set ftp:ssl-allow no
   ls -la
   ```
3. Sube un archivo de contenido **único** (timestamp + random) a esa
   ubicación y pídelo directo por HTTP al dominio real
   (`curl https://dominio.com/archivo-unico.txt`). Si aparece, esa es la
   ruta correcta. Si no aparece, sigues en el lugar equivocado —
   **no automatices todavía.**
4. Solo con esa ruta ya confirmada a mano, arma el workflow real de
   GitHub Actions con `server-dir` (si hace falta) apuntando ahí.
5. Repite el mismo tipo de prueba (archivo único + `curl`) después del
   primer deploy automatizado, para confirmar que el flujo completo
   también aterriza donde debe.

**No se vale** cambiar la ruta de destino a ciegas y re-desplegar "a ver
si esta sí" — cada intento así cuesta tiempo y no da información nueva. Si
algo falla, diagnostica con `lftp` manual antes de tocar el workflow otra
vez.

---

## Checklist de arranque de cada proyecto nuevo

- [ ] Repo en GitHub creado.
- [ ] Dominio (aunque sea temporal de Hostinger) identificado.
- [ ] Cuenta FTP dedicada creada en Hostinger para ese dominio.
- [ ] Base de datos MySQL creada en hPanel, con su propio usuario/contraseña
      (no reutilizar credenciales de otro proyecto).
- [ ] Verificación manual de la ruta FTP hecha (ver sección de arriba) —
      **antes** de tocar GitHub Actions.
- [ ] Secrets configurados en GitHub → Settings → Secrets and variables →
      Actions: `HOSTINGER_FTP_SERVER`, `HOSTINGER_FTP_USERNAME`,
      `HOSTINGER_FTP_PASSWORD`, y las credenciales de MySQL que necesite
      la API PHP (como secret, inyectadas en build o en un `config.php`
      generado en el propio deploy — nunca committeadas).
- [ ] `.gitignore` cubre cualquier archivo con credenciales locales.
- [ ] Backup de base de datos programado desde el día uno.
- [ ] `CLAUDE.md` en la raíz del repo, documentando el flujo de deploy de
      ESE proyecto específico (copiar el patrón de `robsen-salon/CLAUDE.md`)
      — así la próxima sesión no tiene que redescubrir nada.

---

## Qué traer cuando llegue el archivo de frontend (mensaje 2)

Cuando Claude Design entregue el frontend, antes de empezar el backend
conviene tener claro:

- Qué entidades/tablas necesita el negocio (equivalente a lo que en Robsen
  fueron `clientas`, `citas`, `ventas`, `servicios`…).
- Qué roles de usuario existen y qué puede hacer cada uno (para las
  reglas de autorización en PHP, ya que no hay RLS automático).
- Si el negocio necesita algo tipo WhatsApp/notificaciones — en Robsen se
  integró con Meta Cloud API directo; el patrón es reutilizable pero es
  trabajo aparte, no asumir que viene incluido.

---

## Resumen de la lección de julio 2026 (Robsen)

Se rotó la contraseña del FTP. El conector usado entonces
(`SamKirkland/FTP-Deploy-Action`) reportaba éxito en cada intento pero
escribía en un directorio vacío y paralelo al real — nunca dio un error
que lo delatara. Se probaron rutas a ciegas sin resultado. Lo que sí
funcionó fue diagnosticar con `lftp` crudo (mismas credenciales) más un
archivo de contenido único pedido por HTTP, lo cual reveló la ruta real y
confirmó que el conector fallaba. La solución fue reemplazarlo por `lftp
mirror --reverse` directo, ya verificado a mano. Ese es el mecanismo que
esta plantilla usa por defecto — evita repetir el problema desde el
diseño, no como parche después.
