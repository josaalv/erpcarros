import { supabase } from './supabase'

/**
 * Lectura de prosubastas.com.mx/subastas/ a través de la Edge Function
 * `prosubastas` (su servidor no permite leerlo directo desde el navegador).
 * La estructura pública es:
 *   /subastas/2026_10_09/            → una carpeta por patio (GDL/, TOL/, MID/)
 *   /subastas/2026_10_09/GDL/        → un PDF por empresa vendedora
 *   /subastas/2026_10_09/GDL/01.-FC_GDL-Listado de Unidades (…).pdf
 * Dentro de un patio, las subcarpetas "1er/", "2do/"… son avances anteriores
 * del listado; los PDF sueltos en la carpeta del patio son el listado final
 * de participación. Se usa siempre la versión más reciente: la del patio si
 * tiene PDFs, si no el avance más alto.
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

function datosDeUrl(url: string): { fecha: string; patio: string } {
  const partes = decodeURIComponent(new URL(url).pathname).replace(/^\/subastas\//, '').split('/').filter(Boolean)
  const f = partes[0]?.match(/^(\d{4})_(\d{2})_(\d{2})$/)
  return { fecha: f ? `${f[1]}-${f[2]}-${f[3]}` : '', patio: partes[1] && !partes[1].endsWith('.pdf') ? partes[1] : '' }
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

/** Todas las empresas de un patio, en su versión más reciente. */
async function listadosDePatio(carpeta: string): Promise<ArchivoListado[]> {
  const raiz = enlaces(await (await traer(carpeta)).text(), carpeta)
  if (raiz.pdfs.length) return raiz.pdfs.map((u) => archivo(u, 'Listado final'))
  const avances = [...raiz.carpetas].sort((a, b) => numeroAvance(b) - numeroAvance(a))
  for (const c of avances) {
    const pdfs = enlaces(await (await traer(c)).text(), c).pdfs
    if (pdfs.length) {
      const nombre = decodeURIComponent(c).replace(/\/$/, '').split('/').pop() ?? ''
      return pdfs.map((u) => archivo(u, `${nombre} avance`))
    }
  }
  return []
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
  // /subastas/<fecha>/<patio>/[1er/][archivo.pdf] → nos quedamos con fecha y patio.
  const partes = url.pathname.replace(/^\/subastas\//, '').split('/').filter(Boolean).filter((p) => !/\.pdf$/i.test(p))
  if (!/^\d{4}_\d{2}_\d{2}$/.test(partes[0] ?? '')) throw new Error('El enlace debe incluir la carpeta de la fecha, p. ej. …/subastas/2026_10_09/')
  const fechaCarpeta = `${BASE}${partes[0]}/`
  if (partes[1]) return listadosDePatio(`${fechaCarpeta}${partes[1]}/`)

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
