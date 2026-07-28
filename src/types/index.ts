export type Rol = 'admin' | 'gerencia' | 'comisionista' | 'demo'

export interface Perfil {
  id: string
  nombre: string
  rol: Rol
  activo: boolean
}

/** Fila de listar_perfiles_publicos() (RPC anon, sin RLS de perfil): solo
 * las columnas necesarias para el selector de perfiles del login. */
export interface PerfilPublico {
  id: string
  nombre: string
  rol: Rol
  correo: string
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
  /** Kilometraje corregido al terminar la reparación — el de llegada a
   * veces viene alterado desde la subasta. */
  kilometraje_final: number | null
  descripcion_breve: string | null
  indicaciones_comisionista: string | null
  comision_ofrecida: number | null
}

export interface Gasto {
  id: number
  vehiculo_id: number
  categoria_id: number
  descripcion: string
  importe: number
  fecha: string
  pagador_tipo: 'empresa' | 'socio'
  pagador_socio_id: number | null
  created_at: string
}

export interface Socio {
  id: number
  nombre: string
  telefono: string | null
  correo: string | null
  activo: boolean
}

export interface Aportacion {
  id: number
  vehiculo_id: number
  socio_id: number
  monto: number
  fecha: string
}

export interface ParticipacionSocio {
  vehiculo_id: number
  socio_id: number
  capital_aportado: number
  participacion: number
}

export interface TipoDocumento {
  id: number
  clave: string
  nombre: string
  obligatorio: boolean
  confidencial: boolean
  orden: number
  activo: boolean
  es_personalizado: boolean
}

export interface Documento {
  id: number
  vehiculo_id: number
  tipo_documento_id: number
  estado: 'faltante' | 'en_tramite' | 'completo'
  fecha_obtencion: string | null
  observaciones: string | null
  archivo_path: string | null
  /** Si esta categoría aplica a esta unidad en particular — el tipo de
   * documentación varía mucho de un carro a otro. */
  activo: boolean
}

export interface SubestadoTaller {
  id: number
  clave: string
  nombre: string
  activo: boolean
}

export interface OrdenTrabajo {
  id: number
  folio: string
  vehiculo_id: number
  tipo: 'interna' | 'externa'
  especialidad: string | null
  proveedor_id: number | null
  descripcion: string
  prioridad: 'baja' | 'normal' | 'alta'
  fecha_inicio: string | null
  fecha_estimada: string | null
  fecha_real: string | null
  estado: 'abierta' | 'en_proceso' | 'espera_piezas' | 'terminada' | 'cancelada'
  es_retrabajo: boolean
  observaciones: string | null
}

export interface Lote {
  id: number
  nombre: string
  contacto: string | null
  telefono: string | null
  activo: boolean
}

export interface Consignacion {
  id: number
  vehiculo_id: number
  lote_id: number
  precio_asignado: number
  fecha_envio: string
  fecha_retiro: string | null
  estado: 'en_consignacion' | 'retirada' | 'vendida_por_lote' | 'conciliada'
  fecha_venta_reportada: string | null
  fecha_pago_recibido: string | null
  observaciones: string | null
}

export interface Comisionista {
  id: number
  perfil_id: string | null
  nombre: string
  telefono: string | null
  correo: string | null
  ver_comisiones: boolean
  activo: boolean
}

export interface Cliente {
  id: number
  nombre: string
  telefono: string | null
  correo: string | null
  origen: 'referido' | 'lote' | 'anuncio' | 'directo' | 'otro'
  notas: string | null
}

export interface Prospecto {
  id: number
  cliente_id: number
  vehiculo_id: number | null
  comisionista_id: number | null
  etapa: string
  fecha_registro: string
  vence_atribucion: string | null
  motivo_perdida: string | null
}

export interface Venta {
  id: number
  vehiculo_id: number
  cliente_id: number | null
  comisionista_id: number | null
  consignacion_id: number | null
  canal: 'directa' | 'consignacion' | 'comisionista' | 'anuncio'
  precio_acordado: number
  forma_pago: 'efectivo' | 'transferencia' | 'financiera' | 'toma_a_cuenta' | 'mixto'
  fecha_venta: string
  fecha_entrega: string | null
  estado: 'en_proceso' | 'completada' | 'entregada' | 'cancelada'
  observaciones: string | null
}

export interface Comision {
  id: number
  venta_id: number
  comisionista_id: number
  esquema: 'fijo' | 'porcentaje_venta' | 'porcentaje_utilidad' | 'especial'
  monto_estimado: number | null
  monto_autorizado: number | null
  fecha_autorizacion: string | null
  monto_pagado: number | null
  fecha_pago: string | null
}

export interface CierreFinanciero {
  id: number
  vehiculo_id: number
  venta_id: number | null
  costo_total: number
  precio_final: number
  utilidad_bruta: number
  margen: number
  roi: number
  dias_inventario: number
  canal_venta: string
  estado: 'cerrado' | 'reabierto'
  fecha_cierre: string
}

export interface Reapertura {
  id: number
  cierre_id: number
  motivo: string
  usuario_id: string
  ocurrido: string
}

export interface Liquidacion {
  id: number
  cierre_id: number
  vehiculo_id: number
  socio_id: number
  capital_aportado: number
  participacion: number
  utilidad_asignada: number
  monto_a_pagar: number
  pagado: boolean
  fecha_pago: string | null
}

export interface Subasta {
  id: number
  plataforma: string
  fecha: string
  lote: string | null
  patio_origen: string | null
}

export interface EvaluacionPuja {
  id: number
  subasta_id: number | null
  vehiculo_id: number | null
  marca: string
  modelo: string
  anio: number
  version: string | null
  kilometraje_llegada: number | null
  torre: string | null
  danos_observados: string | null
  costo_reparacion_estimado: number
  precio_venta_esperado: number
  margen_deseado: number | null
  techo_puja: number | null
  roi_proyectado: number | null
  roi_historico_segmento: number | null
  resultado: 'pendiente' | 'ganada' | 'perdida' | 'descartada'
}

export interface RoiSegmento {
  marca: string
  modelo: string
  banda: 'baja' | 'media' | 'alta'
  unidades: number
  margen_promedio: number
  roi_promedio: number
  dias_promedio: number
}
