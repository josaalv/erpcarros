export type Rol = 'admin' | 'gerencia' | 'comisionista' | 'demo'

export interface Perfil {
  id: string
  nombre: string
  rol: Rol
  activo: boolean
}

export interface EstadoProceso {
  id: number
  clave: string
  nombre: string
  orden: number
  es_final: boolean
}

export interface Ubicacion {
  id: number
  clave: string
  nombre: string
  es_externa: boolean
}

export interface CategoriaGasto {
  id: number
  clave: string
  nombre: string
  grupo: string
}

/** Fila de la vista v_vehiculo_ficha: los campos financieros llegan NULL
 * cuando el rol no los permite (RN-12) — la redacción ocurre en Supabase,
 * nunca en el cliente. */
export interface VehiculoFicha {
  id: number
  id_interno: string
  vin: string | null
  marca: string
  modelo: string
  version: string | null
  anio: number
  kilometraje: number | null
  color: string | null
  transmision: string | null
  estado_proceso_id: number
  ubicacion_id: number
  estado_comercial: string
  estado_documental: string
  fecha_compra: string | null
  precio_autorizado: number | null
  precio_lote: number | null
  canal_venta: string | null
  es_demo: boolean
  precio_minimo: number | null
  costo_total: number | null
  utilidad: number | null
  margen: number | null
}
