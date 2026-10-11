import { supabase } from './supabase'
import type { GastoPago, ModalidadPropiedad } from '../types'

export const MODALIDAD_LABEL: Record<ModalidadPropiedad, string> = {
  unica: 'Propiedad única',
  copropiedad: 'Copropiedad',
  excepcion: 'Excepción de propiedad',
}

export const MODALIDAD_AYUDA: Record<ModalidadPropiedad, string> = {
  unica: 'Un solo dueño cubre la compra y los gastos; se queda con toda la utilidad.',
  copropiedad: 'Varios dueños. Al cerrar la venta, a cada uno le toca según el capital que puso (compra + gastos que pagó).',
  excepcion: 'El reparto se acuerda a mano como % del total de la venta, sin importar cuánto puso cada uno.',
}

export const ORIGEN_LABEL: Record<GastoPago['origen'], string> = { fondo: 'De su parte del fondo', bolsa: 'De su bolsa' }

/** Propiedad guardada en la unidad (columnas de vehiculo, migración 026). */
export interface PropiedadVehiculo { modalidad_propiedad: ModalidadPropiedad; propietario_id: number | null }

/** Fila del editor: % como texto (lo que escribe el usuario, 0–100). */
export interface FilaPago { socioId: string; porcentaje: string; origen: GastoPago['origen'] }

/** Filas iniciales: las guardadas, o el propietario al 100% en propiedad única. */
export function filasIniciales(pagos: GastoPago[], propiedad: PropiedadVehiculo | null): FilaPago[] {
  if (pagos.length) return pagos.map((p) => ({ socioId: String(p.socio_id), porcentaje: String(+(p.porcentaje * 100).toFixed(2)), origen: p.origen }))
  if (propiedad?.modalidad_propiedad === 'unica' && propiedad.propietario_id) {
    return [{ socioId: String(propiedad.propietario_id), porcentaje: '100', origen: 'fondo' }]
  }
  return [{ socioId: '', porcentaje: '100', origen: 'fondo' }]
}

/** Valida las filas: sin repetir socio y suma 100% (o ninguna fila con socio = sin asignar). */
export function validarPagos(filas: FilaPago[]): string | null {
  const usadas = filas.filter((f) => f.socioId)
  if (!usadas.length) return null
  if (new Set(usadas.map((f) => f.socioId)).size !== usadas.length) return 'Un socio aparece dos veces en "¿Quién pagó?".'
  if (usadas.some((f) => !(Number(f.porcentaje) > 0))) return 'Cada socio que pagó necesita un % mayor a 0.'
  const suma = usadas.reduce((a, f) => a + Number(f.porcentaje), 0)
  if (Math.abs(suma - 100) > 0.01) return `Los porcentajes de "¿Quién pagó?" suman ${+suma.toFixed(2)}%: deben sumar 100%.`
  return null
}

/** Reemplaza los pagadores de un gasto por las filas dadas. */
export async function guardarPagos(gastoId: number, filas: FilaPago[]): Promise<string | null> {
  if (!supabase) return null
  const { error: e1 } = await supabase.from('gasto_pago').delete().eq('gasto_id', gastoId)
  if (e1) return e1.message
  const nuevas = filas.filter((f) => f.socioId).map((f) => ({
    gasto_id: gastoId, socio_id: Number(f.socioId), porcentaje: Number(f.porcentaje) / 100, origen: f.origen,
  }))
  if (!nuevas.length) return null
  const { error: e2 } = await supabase.from('gasto_pago').insert(nuevas)
  return e2?.message ?? null
}
