import { supabase } from './supabase'
import { hoyISO } from './helpers'
import { subirArchivo } from './archivos'
import { buscarCarpetaUnidad, descargarDropbox, reducirFoto } from './dropbox'

/**
 * Al adquirir: copia de Dropbox a la unidad la hoja de inspección (como
 * "Cotización de daños subasta"), el REPUVE y hasta `maxFotos` fotos
 * reducidas (~200 KB c/u: el Storage gratuito es de 1 GB). Devuelve un
 * resumen o lanza error; la unidad ya existe, así que un fallo aquí no la
 * deshace — se puede reintentar desde el Expediente.
 */
export async function copiarDeDropbox(opciones: {
  enlace: string; torre: string; stock: string | null; vendedor?: string | null; vehiculoId: number; maxFotos?: number; onAvance?: (texto: string) => void
}): Promise<string> {
  const { enlace, torre, stock, vendedor, vehiculoId, maxFotos = 8, onAvance } = opciones
  const c = await buscarCarpetaUnidad(enlace, torre, stock, { codigo: torre.split('-')[0], vendedor })
  if (!c) return `No se encontró la carpeta de la torre ${torre} en Dropbox.`
  if (!c.coincideStock) return `La carpeta de la torre ${torre} en Dropbox no corresponde al stock ${stock}; no se copió nada.`

  const { data: tipos } = await supabase!.from('tipo_documento').select('id, clave').in('clave', ['cotizacion_danos_subasta', 'repuve'])
  const tipoDe = (clave: string) => (tipos ?? []).find((t) => t.clave === clave)?.id as number | undefined
  let docs = 0
  for (const [archivo, claveTipo] of [[c.inspeccion, 'cotizacion_danos_subasta'], [c.repuve, 'repuve']] as const) {
    const tipoId = tipoDe(claveTipo)
    if (!archivo || !tipoId) continue
    onAvance?.(`Copiando ${archivo.nombre}…`)
    const ruta = await subirArchivo(vehiculoId, String(tipoId), await descargarDropbox(enlace, archivo.ruta), archivo.nombre)
    const { error } = await supabase!.from('documento').insert({
      vehiculo_id: vehiculoId, tipo_documento_id: tipoId, estado: 'completo', archivo_path: ruta, fecha_obtencion: hoyISO(),
    })
    if (error) throw new Error(`No se pudo registrar ${archivo.nombre}: ${error.message}`)
    docs++
  }

  const rutas: string[] = []
  for (const [i, f] of c.fotos.slice(0, maxFotos).entries()) {
    onAvance?.(`Copiando foto ${i + 1} de ${Math.min(maxFotos, c.fotos.length)}…`)
    const reducida = await reducirFoto(await descargarDropbox(enlace, f.ruta))
    rutas.push(await subirArchivo(vehiculoId, 'fotos', reducida, f.nombre.replace(/\.\w+$/, '.jpg')))
  }
  if (rutas.length) {
    const { error } = await supabase!.from('vehiculo').update({ fotos: rutas }).eq('id', vehiculoId)
    if (error) throw new Error(`Las fotos se subieron pero no se ligaron a la unidad: ${error.message}`)
  }
  return `Se copiaron ${docs} documento(s) y ${rutas.length} foto(s) de Dropbox.`
}
