/**
 * Dropbox desde el navegador (la API acepta llamadas directas desde
 * josaalv.github.io: CORS verificado). Conexión con OAuth PKCE: solo hace
 * falta la "App key" (pública, se guarda en parametro.dropbox_app_key); no
 * hay secreto. El refresh token se guarda en localStorage de ESTE navegador,
 * no en la base: cada administrador conecta su navegador una vez.
 *
 * La carpeta compartida de una subasta trae una carpeta por vendedor
 * ("01 FC") y dentro una por unidad ("FC 01" = torre FC-1) con
 * "<stock>.pdf" (hoja de inspección), "<stock> REPUVE.pdf" y fotos JPG.
 */

const CLAVE_TOKEN = 'dropbox:token'
const CLAVE_PKCE = 'dropbox:pkce'

interface Token { access: string; expira: number; refresh: string; appKey: string }

function leerToken(): Token | null {
  try { return JSON.parse(localStorage.getItem(CLAVE_TOKEN) ?? 'null') } catch { return null }
}
function guardarToken(t: Token) {
  try { localStorage.setItem(CLAVE_TOKEN, JSON.stringify(t)) } catch { /* sin storage: habrá que reconectar */ }
}

export function dropboxConectado(): boolean {
  return Boolean(leerToken()?.refresh)
}

export function desconectarDropbox() {
  try { localStorage.removeItem(CLAVE_TOKEN) } catch { /* nada que borrar */ }
}

const redirectUri = () => `${window.location.origin}${window.location.pathname}`

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Manda a Dropbox para autorizar; regresa a la app con ?code=… */
export async function conectarDropbox(appKey: string) {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)))
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  const state = base64url(crypto.getRandomValues(new Uint8Array(16)))
  sessionStorage.setItem(CLAVE_PKCE, JSON.stringify({ verifier, state, appKey, volverA: window.location.hash }))
  const q = new URLSearchParams({
    client_id: appKey, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256',
    token_access_type: 'offline', redirect_uri: redirectUri(), state,
  })
  window.location.href = `https://www.dropbox.com/oauth2/authorize?${q}`
}

/**
 * Se llama al arrancar la app: si Dropbox regresó con ?code=…, lo cambia por
 * el token y deja la URL limpia en la pantalla donde estaba el usuario.
 * Va antes del router porque el código llega en la query, no en el hash.
 */
export async function completarConexionDropbox(): Promise<string | null> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) return null
  let guardado: { verifier: string; state: string; appKey: string; volverA: string } | null = null
  try { guardado = JSON.parse(sessionStorage.getItem(CLAVE_PKCE) ?? 'null') } catch { guardado = null }
  sessionStorage.removeItem(CLAVE_PKCE)
  const limpiar = (hash: string) => window.history.replaceState(null, '', `${window.location.pathname}${hash || '#/'}`)
  if (!guardado || params.get('state') !== guardado.state) { limpiar('#/configuracion'); return 'La conexión con Dropbox no coincide. Intenta de nuevo.' }
  const r = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      code, grant_type: 'authorization_code', code_verifier: guardado.verifier,
      client_id: guardado.appKey, redirect_uri: redirectUri(),
    }),
  })
  limpiar(guardado.volverA)
  if (!r.ok) return `Dropbox rechazó la conexión (${r.status}). Revisa la App key y la Redirect URI.`
  const j = await r.json() as { access_token: string; expires_in: number; refresh_token: string }
  guardarToken({ access: j.access_token, expira: Date.now() + (j.expires_in - 60) * 1000, refresh: j.refresh_token, appKey: guardado.appKey })
  return null
}

async function accessToken(): Promise<string> {
  const t = leerToken()
  if (!t) throw new Error('Dropbox no está conectado en este navegador (Configuración → General).')
  if (Date.now() < t.expira) return t.access
  const r = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: t.appKey }),
  })
  if (!r.ok) { desconectarDropbox(); throw new Error('Se venció el permiso de Dropbox. Vuelve a conectarlo en Configuración.') }
  const j = await r.json() as { access_token: string; expires_in: number }
  guardarToken({ ...t, access: j.access_token, expira: Date.now() + (j.expires_in - 60) * 1000 })
  return j.access_token
}

// El encabezado Dropbox-API-Arg solo admite ASCII: acentos y ñ van como \uXXXX.
const argAscii = (o: unknown) => JSON.stringify(o).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))

async function rpc<T>(ruta: string, cuerpo: unknown): Promise<T> {
  const r = await fetch(`https://api.dropboxapi.com/2/${ruta}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
  if (!r.ok) throw new Error(`Dropbox (${ruta}): ${r.status} ${(await r.text()).slice(0, 160)}`)
  return r.json() as Promise<T>
}

async function contenido(ruta: string, arg: unknown): Promise<Blob> {
  const r = await fetch(`https://content.dropboxapi.com/2/${ruta}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Dropbox-API-Arg': argAscii(arg) },
  })
  if (!r.ok) throw new Error(`Dropbox (${ruta}): ${r.status}`)
  return r.blob()
}

export interface EntradaDropbox { tipo: 'folder' | 'file'; nombre: string; ruta: string; tamano?: number }

/** Contenido de una carpeta dentro del enlace compartido ('' = raíz). */
export async function listarCarpeta(enlace: string, ruta = ''): Promise<EntradaDropbox[]> {
  type Resp = { entries: { '.tag': 'folder' | 'file'; name: string; size?: number }[]; cursor: string; has_more: boolean }
  const salida: EntradaDropbox[] = []
  let r = await rpc<Resp>('files/list_folder', { path: ruta, shared_link: { url: enlace } })
  for (;;) {
    for (const e of r.entries) salida.push({ tipo: e['.tag'], nombre: e.name, ruta: `${ruta}/${e.name}`, tamano: e.size })
    if (!r.has_more) break
    r = await rpc<Resp>('files/list_folder/continue', { cursor: r.cursor })
  }
  return salida
}

export async function miniaturaDropbox(enlace: string, ruta: string): Promise<Blob> {
  return contenido('files/get_thumbnail_v2', { resource: { '.tag': 'link', url: enlace, path: ruta }, format: 'jpeg', size: 'w480h320', mode: 'fitone_bestfit' })
}

const TIPOS: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf' }

/** Tipo del archivo por su extensión (Dropbox lo manda como "octet-stream" y el navegador lo descargaría). */
export function tipoPorNombre(nombre: string): string {
  return TIPOS[nombre.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'
}

export async function descargarDropbox(enlace: string, ruta: string): Promise<Blob> {
  const b = await contenido('sharing/get_shared_link_file', { url: enlace, path: ruta })
  return new Blob([b], { type: tipoPorNombre(ruta) })
}

export interface CarpetaUnidad {
  ruta: string
  fotos: EntradaDropbox[]
  inspeccion: EntradaDropbox | null
  repuve: EntradaDropbox | null
  /** false si la carpeta de la torre existe pero sus archivos son de otro stock. */
  coincideStock: boolean
}

// Cache por enlace: abrir varias unidades de la misma subasta no vuelve a
// listar la raíz. Dura 3 minutos: las carpetas se van llenando conforme
// Prosubastas sube fotos, y lo nuevo debe aparecer sin recargar la página.
const cacheCarpetas = new Map<string, { hasta: number; p: Promise<EntradaDropbox[]> }>()
export const listarConCache = (enlace: string, ruta: string) => {
  const k = `${enlace}|${ruta}`
  const hit = cacheCarpetas.get(k)
  if (hit && hit.hasta > Date.now()) return hit.p
  const p = listarCarpeta(enlace, ruta).catch((e) => { cacheCarpetas.delete(k); throw e })
  cacheCarpetas.set(k, { hasta: Date.now() + 3 * 60_000, p })
  return p
}

/** Olvida lo leído de un enlace (al volver a ligar: puede haber carpetas nuevas). */
export function olvidarCarpetas(enlace: string) {
  for (const k of [...cacheCarpetas.keys()]) if (k.startsWith(`${enlace}|`)) cacheCarpetas.delete(k)
}

const sinCeros = (s: string) => s.replace(/\b0+(\d)/g, '$1')
const clave = (s: string) => sinCeros(s.toUpperCase().replace(/[\s_-]+/g, ' ').trim())

/** "01 FC", "07 GA", "11. MLS"… = carpeta de una empresa vendedora. */
const esCarpetaVendedor = (nombre: string) => /^\d{1,3}\s*[-_.]?\s*[A-Za-z]/.test(nombre.trim())

/**
 * Carpetas de empresa vendedora del enlace. Normalmente están en la raíz,
 * pero el enlace también puede ser una carpeta general (p. ej. una por patio
 * o por fecha, que se va llenando): entonces se buscan hasta dos niveles
 * abajo. `grupo` es la carpeta que las contiene ('' si están en la raíz).
 */
export async function carpetasDeVendedor(enlace: string): Promise<(EntradaDropbox & { grupo: string })[]> {
  const buscar = async (ruta: string, nivel: number): Promise<(EntradaDropbox & { grupo: string })[]> => {
    const carpetas = (await listarConCache(enlace, ruta)).filter((e) => e.tipo === 'folder')
    const vendedores = carpetas.filter((c) => esCarpetaVendedor(c.nombre))
    if (vendedores.length) return vendedores.map((v) => ({ ...v, grupo: ruta.split('/').filter(Boolean).join(' / ') }))
    if (nivel >= 2) return []
    return (await Promise.all(carpetas.slice(0, 20).map((c) => buscar(c.ruta, nivel + 1)))).flat()
  }
  return buscar('', 0)
}

/**
 * Busca la carpeta de una unidad: la de su vendedor ("01 FC" para torres
 * FC-n) y dentro la de su torre ("FC 01" = "FC-1"). Confirma con el número
 * de stock en los nombres de archivo; si hay varias (un enlace general con
 * varios patios) se queda con la que trae su stock; si ninguna lo trae, lo
 * reporta en coincideStock para que la pantalla avise.
 */
export async function buscarCarpetaUnidad(enlace: string, torre: string, stock: string | null): Promise<CarpetaUnidad | null> {
  const prefijo = torre.split('-')[0].toUpperCase()
  const vendedores = await carpetasDeVendedor(enlace)
  const candidatos = vendedores.filter((v) => v.nombre.toUpperCase().replace(/[-_.]/g, ' ').split(/\s+/).includes(prefijo))
  // Si no hay carpeta por vendedor, las unidades pueden estar directo en la raíz.
  const dondeBuscar = candidatos.length ? candidatos.map((c) => c.ruta) : ['']
  let primera: CarpetaUnidad | null = null
  for (const ruta of dondeBuscar) {
    const unidades = await listarConCache(enlace, ruta)
    const carpeta = unidades.find((u) => u.tipo === 'folder' && clave(u.nombre) === clave(torre))
    if (!carpeta) continue
    const archivos = (await listarConCache(enlace, carpeta.ruta)).filter((a) => a.tipo === 'file')
    const pdfs = archivos.filter((a) => /\.pdf$/i.test(a.nombre))
    const repuve = pdfs.find((a) => /repuve/i.test(a.nombre)) ?? null
    const inspeccion = pdfs.find((a) => a !== repuve && (!stock || a.nombre.startsWith(stock))) ?? pdfs.find((a) => a !== repuve) ?? null
    const encontrada: CarpetaUnidad = {
      ruta: carpeta.ruta,
      fotos: archivos.filter((a) => /\.(jpe?g|png|webp|heic)$/i.test(a.nombre)).sort((a, b) => a.nombre.localeCompare(b.nombre)),
      inspeccion,
      repuve,
      coincideStock: !stock || archivos.some((a) => a.nombre.includes(stock)),
    }
    if (encontrada.coincideStock) return encontrada
    primera ??= encontrada
  }
  return primera
}

/** Reduce una foto a máx. `lado` px (JPEG) para no llenar el Storage gratuito (1 GB). */
export async function reducirFoto(blob: Blob, lado = 1280, calidad = 0.8): Promise<Blob> {
  const bmp = await createImageBitmap(blob)
  const escala = Math.min(1, lado / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * escala)
  canvas.height = Math.round(bmp.height * escala)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo reducir la foto'))), 'image/jpeg', calidad))
}

/** "FC 01" → "FC-1" (formato de torre del listado). */
export function torreDeCarpeta(nombre: string): string {
  const m = nombre.trim().match(/^([A-Za-z]{1,5})[\s_-]*0*(\d{1,4})$/)
  return m ? `${m[1].toUpperCase()}-${m[2]}` : nombre.trim()
}

export interface UnidadDropbox {
  carpeta: EntradaDropbox
  torre: string
  stock: string | null
  fotos: EntradaDropbox[]
}

/** Carpetas de vendedor de la subasta ("01 FC" → código FC; con el patio delante si el enlace trae varios). */
export async function vendedoresDropbox(enlace: string): Promise<{ carpeta: EntradaDropbox; codigo: string }[]> {
  const carpetas = await carpetasDeVendedor(enlace)
  const varios = new Set(carpetas.map((c) => c.grupo)).size > 1
  return carpetas.map(({ grupo, ...carpeta }) => {
    const codigo = carpeta.nombre.replace(/^\d+\s*[-_.]?\s*/, '').trim() || carpeta.nombre
    return { carpeta, codigo: varios && grupo ? `${grupo.split(' / ').pop()} · ${codigo}` : codigo }
  })
}

/** Unidades dentro de la carpeta de un vendedor, con su stock (del nombre del PDF) y sus fotos. */
export async function unidadesDeVendedor(enlace: string, rutaVendedor: string, alAvanzar?: (u: UnidadDropbox) => void): Promise<UnidadDropbox[]> {
  const carpetas = (await listarConCache(enlace, rutaVendedor)).filter((e) => e.tipo === 'folder')
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
  const salida: UnidadDropbox[] = []
  for (let i = 0; i < carpetas.length; i += 4) {
    const lote = await Promise.all(carpetas.slice(i, i + 4).map(async (carpeta) => {
      const archivos = (await listarConCache(enlace, carpeta.ruta)).filter((a) => a.tipo === 'file')
      const pdf = archivos.find((a) => /^\d{3,8}\.pdf$/i.test(a.nombre)) ?? archivos.find((a) => /^\d{3,8}\b.*\.pdf$/i.test(a.nombre))
      const u: UnidadDropbox = {
        carpeta,
        torre: torreDeCarpeta(carpeta.nombre),
        stock: pdf?.nombre.match(/^(\d{3,8})/)?.[1] ?? null,
        fotos: archivos.filter((a) => /\.(jpe?g|png|webp)$/i.test(a.nombre)).sort((a, b) => a.nombre.localeCompare(b.nombre)),
      }
      alAvanzar?.(u)
      return u
    }))
    salida.push(...lote)
  }
  return salida
}
