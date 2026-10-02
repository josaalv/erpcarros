export function mxn(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—'
  return '$' + Math.round(valor).toLocaleString('es-MX')
}

export function porcentaje(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—'
  return (valor * 100).toFixed(1) + '%'
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Se parte la cadena a mano: new Date('2026-07-28') se interpreta en UTC y en
// México mostraría el día anterior.
export function fecha(valor: string | null | undefined): string {
  if (!valor) return '—'
  const [a, m, d] = valor.slice(0, 10).split('-').map(Number)
  if (!a || !m || !d) return valor
  return `${d} ${MESES[m - 1]} ${a}`
}

export function hoyISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function diasDesde(valor: string | null | undefined): number | null {
  if (!valor) return null
  const [a, m, d] = valor.slice(0, 10).split('-').map(Number)
  const inicio = new Date(a, m - 1, d).getTime()
  return Math.max(0, Math.floor((Date.now() - inicio) / 86400000))
}

export function km(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—'
  return `${valor.toLocaleString('es-MX')} km`
}

export function numeroONull(valor: string): number | null {
  return valor.trim() === '' ? null : Number(valor)
}

export const ROL_LABEL: Record<string, string> = {
  admin: 'Administrador',
  gerencia: 'Gerencia',
  comisionista: 'Comisionista',
  demo: 'Demostración',
}

export type Tono = 'neutral' | 'ok' | 'aviso' | 'peligro' | 'info' | 'primario'
export interface Etiqueta { label: string; tono: Tono }

export const ESTADO_COMERCIAL: Record<string, Etiqueta> = {
  no_publicado: { label: 'Sin publicar', tono: 'neutral' },
  publicado: { label: 'Publicado', tono: 'info' },
  en_consignacion: { label: 'En consignación', tono: 'primario' },
  con_referidos: { label: 'Con referidos', tono: 'primario' },
  apartado: { label: 'Apartado', tono: 'aviso' },
  vendido: { label: 'Vendido', tono: 'ok' },
}

export const ESTADO_DOCUMENTAL: Record<string, Etiqueta> = {
  incompleto: { label: 'Incompleta', tono: 'peligro' },
  en_tramite: { label: 'En trámite', tono: 'aviso' },
  completo: { label: 'Completa', tono: 'ok' },
}

export const ESTADO_DOCUMENTO: Record<string, Etiqueta> = {
  faltante: { label: 'Falta', tono: 'peligro' },
  en_tramite: { label: 'En trámite', tono: 'aviso' },
  completo: { label: 'Listo', tono: 'ok' },
}

export const ESTADO_VENTA: Record<string, Etiqueta> = {
  en_proceso: { label: 'En proceso', tono: 'aviso' },
  completada: { label: 'Cerrada', tono: 'ok' },
  entregada: { label: 'Entregada', tono: 'ok' },
  cancelada: { label: 'Cancelada', tono: 'neutral' },
}

export const RESULTADO_EVALUACION: Record<string, Etiqueta> = {
  pendiente: { label: 'Pendiente', tono: 'aviso' },
  ganada: { label: 'Comprada', tono: 'ok' },
  perdida: { label: 'Perdida', tono: 'neutral' },
  descartada: { label: 'Descartada', tono: 'neutral' },
}

export const CANAL_LABEL: Record<string, string> = {
  directa: 'Venta directa',
  consignacion: 'Consignación',
  comisionista: 'Comisionista',
  anuncio: 'Anuncio',
}

export const CANALES = ['directa', 'consignacion', 'comisionista', 'anuncio'] as const
export const FORMAS_PAGO = ['efectivo', 'transferencia', 'financiera', 'toma_a_cuenta', 'mixto'] as const

export function diasEntre(desde: string | null | undefined, hasta: string): number {
  if (!desde) return 0
  const a = desde.slice(0, 10).split('-').map(Number)
  const b = hasta.slice(0, 10).split('-').map(Number)
  return Math.max(0, Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000))
}

export const FORMA_PAGO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  financiera: 'Financiera',
  toma_a_cuenta: 'Toma a cuenta',
  mixto: 'Mixto',
}

export const ESQUEMA_COMISION_LABEL: Record<string, string> = {
  fijo: 'Monto fijo',
  porcentaje_venta: '% de la venta',
  porcentaje_utilidad: '% de la utilidad',
  especial: 'Especial',
}

export const TRANSMISION_LABEL: Record<string, string> = {
  manual: 'Manual',
  automatica: 'Automática',
  otra: 'Otra',
}

export function etiqueta(mapa: Record<string, Etiqueta>, valor: string | null | undefined): Etiqueta {
  if (!valor) return { label: '—', tono: 'neutral' }
  return mapa[valor] ?? { label: legible(valor), tono: 'neutral' }
}

export function legible(valor: string | null | undefined): string {
  if (!valor) return '—'
  const t = valor.replace(/_/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}
