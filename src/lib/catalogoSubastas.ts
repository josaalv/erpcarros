import { supabase } from './supabase'
import { leerListado } from './contratoPdf'
import { clavePatio, type ArchivoListado } from './prosubastas'
import type { Subasta } from '../types'

export interface ResultadoImportacion {
  subastaId: number
  patio: string
  fecha: string
  codigo: string
  vendedor: string
  unidades: number
}

/**
 * Guarda en el catálogo histórico TODAS las unidades de un listado: busca (o
 * crea) la subasta de esa fecha y patio, registra el listado de la empresa y
 * sus unidades. Volver a importar el mismo listado actualiza (no duplica):
 * la llave es subasta + código de empresa, y subasta + torre por unidad.
 */
export async function importarListado(pdf: Blob, origen: Partial<ArchivoListado> & { nombre: string }): Promise<ResultadoImportacion> {
  const listado = await leerListado(pdf)
  if (listado.unidades.length === 0) throw new Error(`${origen.nombre}: no se encontraron unidades (¿es un listado de Prosubastas?).`)
  const fecha = listado.fechaSubasta || origen.fecha || ''
  if (!fecha) throw new Error(`${origen.nombre}: no trae la fecha de la subasta.`)
  const locacion = listado.locacion || origen.patio || ''
  const codigo = listado.unidades[0].torre.split('-')[0].toUpperCase()

  const { data: candidatas, error: errS } = await supabase!.from('subasta').select('*').eq('fecha', fecha)
  if (errS) throw new Error(errS.message)
  const claves = new Set([clavePatio(locacion), clavePatio(origen.patio)].filter(Boolean))
  let subasta = ((candidatas ?? []) as Subasta[]).find((s) => /prosubastas/i.test(s.plataforma) && claves.has(clavePatio(s.patio_origen)))
  if (!subasta) {
    const carpeta = origen.url ? origen.url.slice(0, origen.url.lastIndexOf('/') + 1) : null
    const { data, error } = await supabase!.from('subasta')
      .insert({ plataforma: 'Prosubastas', fecha, patio_origen: locacion || null, url_origen: carpeta })
      .select('*').single()
    if (error || !data) throw new Error(error?.message ?? 'No se pudo crear la subasta.')
    subasta = data as Subasta
  }

  const vendedor = listado.unidades.find((u) => u.vendedor)?.vendedor ?? ''
  const { data: lst, error: errL } = await supabase!.from('subasta_listado').upsert({
    subasta_id: subasta.id, codigo, orden: origen.orden || null, vendedor: vendedor || null,
    url: origen.url ?? null, fecha_reporte: listado.fechaReporte || null, unidades: listado.unidades.length,
  }, { onConflict: 'subasta_id,codigo' }).select('id').single()
  if (errL || !lst) throw new Error(errL?.message ?? 'No se pudo registrar el listado.')

  const { error: errU } = await supabase!.from('subasta_unidad').upsert(listado.unidades.map((u) => ({
    subasta_id: subasta!.id, listado_id: lst.id,
    torre: u.torre, stock: u.stock || null, vin: u.vin || null,
    marca: u.marca, modelo: u.modelo, anio: Number(u.anio) || null, version: u.version || null,
    puertas: u.puertas, color: u.color || null, kilometraje: u.kilometraje,
    equipamiento: u.equipamiento || null, transmision: u.transmision || null, vendedor: u.vendedor || null,
    valor_factura: u.valorFactura, fecha_factura: u.fechaFactura || null, info_documentos: u.documentos || null,
  })), { onConflict: 'subasta_id,torre' })
  if (errU) throw new Error(`${origen.nombre}: ${errU.message}`)

  return { subastaId: subasta.id, patio: locacion, fecha, codigo, vendedor, unidades: listado.unidades.length }
}
