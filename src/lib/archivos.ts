import { supabase } from './supabase'

/** Bucket privado de Storage: documentos y comprobantes de cada unidad (RLS: admin/gerencia). */
export const BUCKET_DOCUMENTOS = 'documentos-vehiculo'

/** Nombre de archivo apto para Storage: sin acentos ni caracteres raros. */
export function nombreSeguro(nombre: string) {
  return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_')
}

/** Sube un archivo a <vehiculo>/<carpeta>/<marca de tiempo>-<nombre> y regresa la ruta. */
export async function subirArchivo(vehiculoId: number, carpeta: string, archivo: Blob, nombre: string): Promise<string> {
  const ruta = `${vehiculoId}/${carpeta}/${Date.now()}-${nombreSeguro(nombre)}`
  const { error } = await supabase!.storage.from(BUCKET_DOCUMENTOS).upload(ruta, archivo)
  if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`)
  return ruta
}

/** Abre un archivo privado en otra pestaña con un enlace temporal. */
export async function abrirArchivo(ruta: string): Promise<string | null> {
  // La pestaña se abre antes de esperar a Supabase: si se abre después del
  // await, el navegador la trata como ventana emergente y la bloquea.
  const ventana = window.open('', '_blank')
  const { data, error } = await supabase!.storage.from(BUCKET_DOCUMENTOS).createSignedUrl(ruta, 120)
  if (error || !data) { ventana?.close(); return error?.message ?? 'No se pudo abrir el archivo.' }
  if (ventana) ventana.location.href = data.signedUrl
  else window.location.href = data.signedUrl
  return null
}

export async function quitarArchivos(rutas: (string | null | undefined)[]) {
  const validas = rutas.filter((r): r is string => Boolean(r))
  if (validas.length > 0) await supabase!.storage.from(BUCKET_DOCUMENTOS).remove(validas)
}
