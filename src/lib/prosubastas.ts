import { supabase } from './supabase'

/**
 * Lectura de prosubastas.com.mx/subastas/ a través de la Edge Function
 * `prosubastas` (su servidor no permite leerlo directo desde el navegador).
 * La estructura pública es:
 *   /subastas/2026_10_09/            → una carpeta por patio (GDL/, TOL/, MID/)
 *   /subastas/2026_10_09/GDL/        → un PDF por empresa vendedora
 *   /subastas/2026_10_09/GDL/01.-FC_GDL-Listado de Unidades (…).pdf
 * También hay subastas con prefijo y el patio ANTES de la fecha:
 *   /subastas/Subasta_IA/TOL/2026_10_16/3er/01. IA TOL - Listado (LF …).pdf
 * Dentro de un patio, las subcarpetas "1er/", "2do/"… son avances del
 * listado. Si algún PDF dice "LF" (listado final) se usan esos; si no, los
 * PDF sueltos en la carpeta del patio y, si no hay, el avance más alto.
 */

const BASE = 'https://prosubastas.com.mx/subastas/'

export interface ArchivoListado {
  url: string
  nombre: string
  /** Carpeta del patio en la URL (GDL, TOL, MID…). */
  patio: string
  /** "2026-10-09" sacado de la carpeta de la fecha. */
  fecha: string
  /** Número al inicio del archivo ("01"), igual al de la carpeta de fotos ("01 FC"). */
  orden: string
  /** "Listado final", "2do avance"… (de qué carpeta salió). */
  version: string
}

async function traer(url: string): Promise<Response> {
  const { data } = await supabase!.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Tu sesión expiró. Vuelve a entrar.')
  const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prosubastas?url=${encodeURIComponent(url)}`, {
    headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
  })
  if (!r.ok) throw new Error(`Prosubastas respondió ${r.status}: ${(await r.text()).slice(0, 160)}`)
  return r
}

export async function descargarListado(url: string): Promise<Blob> {
  return (await traer(url)).blob()
}

const ES_FECHA = /^(\d{4})_(\d{2})_(\d{2})$/

/**
 * Carpetas de la ruta sin el PDF, la posición de la fecha y el patio: el que
 * sigue a la fecha (…/2026_10_09/GDL/) o, con prefijo, el que la antecede
 * (…/Subasta_IA/TOL/2026_10_16/).
 */
function rutaDe(pathname: string): { partes: string[]; iFecha: number; patio: string } {
  const partes = decodeURIComponent(pathname).replace(/^\/subastas\//, '').split('/').filter(Boolean).filter((p) => !/\.pdf$/i.test(p))
  const iFecha = partes.findIndex((p) => ES_FECHA.test(p))
  const patio = iFecha === 0 ? partes[1] ?? '' : iFecha > 0 ? partes[iFecha - 1] : ''
  return { partes, iFecha, patio }
}

function datosDeUrl(url: string): { fecha: string; patio: string } {
  const { partes, iFecha, patio } = rutaDe(new URL(url).pathname)
  const f = iFecha >= 0 ? partes[iFecha].match(ES_FECHA) : null
  return { fecha: f ? `${f[1]}-${f[2]}-${f[3]}` : '', patio }
}

function enlaces(html: string, carpeta: string): { pdfs: string[]; carpetas: string[] } {
  const hrefs = [...html.matchAll(/href="([^"?]+)"/gi)].map((m) => m[1]).filter((h) => !h.startsWith('/') && !h.startsWith('http'))
  return {
    pdfs: hrefs.filter((h) => /\.pdf$/i.test(h)).map((h) => new URL(h, carpeta).toString()),
    carpetas: hrefs.filter((h) => h.endsWith('/')).map((h) => new URL(h, carpeta).toString()),
  }
}

function archivo(url: string, version: string): ArchivoListado {
  const nombre = decodeURIComponent(url.split('/').pop() ?? '')
  const { fecha, patio } = datosDeUrl(url)
  return { url, nombre, patio, fecha, orden: nombre.match(/^(\d{1,3})/)?.[1]?.padStart(2, '0') ?? '', version }
}

/** Número del avance ("1er/" → 1, "2do/" → 2); 0 si no empieza con número. */
function numeroAvance(carpeta: string): number {
  return Number(decodeURIComponent(carpeta).replace(/\/$/, '').split('/').pop()?.match(/^(\d+)/)?.[1] ?? 0)
}

/** "(LF Sub 16Octubre2026)" en el nombre = listado final (ojo: "03.-LF_GDL" es una empresa). */
const esFinal = (url: string) => /\(\s*LF\s/i.test(decodeURIComponent(url.split('/').pop() ?? ''))

/** Todas las empresas de un patio, en su versión más reciente. */
async function listadosDePatio(carpeta: string): Promise<ArchivoListado[]> {
  const raiz = enlaces(await (await traer(carpeta)).text(), carpeta)
  if (raiz.pdfs.length && raiz.pdfs.every(esFinal)) return raiz.pdfs.map((u) => archivo(u, 'Listado final'))
  const avances = [...raiz.carpetas].filter((c) => numeroAvance(c) > 0).sort((a, b) => numeroAvance(b) - numeroAvance(a))
  let ultimo: ArchivoListado[] = []
  for (const c of avances) {
    const pdfs = enlaces(await (await traer(c)).text(), c).pdfs
    if (!pdfs.length) continue
    const nombre = decodeURIComponent(c).replace(/\/$/, '').split('/').pop() ?? ''
    if (pdfs.some(esFinal)) return pdfs.filter(esFinal).map((u) => archivo(u, 'Listado final'))
    if (!ultimo.length) ultimo = pdfs.map((u) => archivo(u, `${nombre} avance`))
    // Sin "LF" en ningún avance, basta con el más alto.
    if (!raiz.pdfs.length) break
  }
  if (raiz.pdfs.length) return raiz.pdfs.map((u) => archivo(u, 'Listado final'))
  return ultimo
}

/**
 * A partir de lo que pegue el usuario (el PDF de una empresa, la carpeta de
 * un patio o la de una fecha) regresa los listados de TODAS las empresas del
 * patio (o de todos los patios de esa fecha). Pegar un solo PDF trae el
 * patio completo: el usuario quiere el registro de todo lo que sale.
 */
export async function buscarListados(entrada: string): Promise<ArchivoListado[]> {
  let url: URL
  try { url = new URL(entrada.trim()) } catch { throw new Error('Pega un enlace completo de prosubastas.com.mx/subastas/…') }
  if (url.hostname !== 'prosubastas.com.mx' || !url.pathname.startsWith('/subastas/')) {
    throw new Error('El enlace debe ser de prosubastas.com.mx/subastas/…')
  }
  // /subastas/<fecha>/<patio>/[1er/][archivo.pdf] o
  // /subastas/<prefijo>/<patio>/<fecha>/[3er/][archivo.pdf] → fecha y patio.
  const { partes, iFecha } = rutaDe(url.pathname)
  if (iFecha < 0) throw new Error('El enlace debe incluir la carpeta de la fecha, p. ej. …/subastas/2026_10_09/')
  const enc = (ps: string[]) => ps.map(encodeURIComponent).join('/')
  if (iFecha > 0) return listadosDePatio(`${BASE}${enc(partes.slice(0, iFecha + 1))}/`)
  const fechaCarpeta = `${BASE}${enc([partes[0]])}/`
  if (partes[1]) return listadosDePatio(`${fechaCarpeta}${enc([partes[1]])}/`)

  const raiz = enlaces(await (await traer(fechaCarpeta)).text(), fechaCarpeta)
  return (await Promise.all(raiz.carpetas.map(listadosDePatio))).flat()
}

/** "GDL" / "Guadalajara" → misma clave, para encontrar la subasta del patio. */
const PATIOS: Record<string, string> = { GDL: 'guadalajara', TOL: 'toluca', MID: 'merida', MTY: 'monterrey', CDMX: 'ciudad de mexico', QRO: 'queretaro', PUE: 'puebla' }
export function clavePatio(s: string | null | undefined): string {
  const t = (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
  return PATIOS[t.toUpperCase()] ?? t
}

export { BASE as BASE_PROSUBASTAS }
