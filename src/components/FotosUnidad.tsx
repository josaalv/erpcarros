import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BUCKET_DOCUMENTOS, quitarArchivos, subirArchivo } from '../lib/archivos'
import { reducirFoto } from '../lib/dropbox'
import { Alerta } from './Ui'

/**
 * Fotos de una unidad (vehiculo.fotos: rutas de Storage; la primera es la
 * portada). Llegan solas al adquirir desde Dropbox y aquí se agregan, se
 * quitan o se cambia la portada. Se guardan reducidas (~200 KB).
 */
export function FotosUnidad({ vehiculoId, puedeEditar }: { vehiculoId: number; puedeEditar: boolean }) {
  const [fotos, setFotos] = useState<string[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    if (!supabase) return
    const { data, error: err } = await supabase.from('vehiculo').select('fotos').eq('id', vehiculoId).maybeSingle()
    if (err) { setError(err.message); return }
    const lista = ((data as { fotos: string[] } | null)?.fotos ?? [])
    setFotos(lista)
    if (lista.length) {
      const { data: firmadas } = await supabase.storage.from(BUCKET_DOCUMENTOS).createSignedUrls(lista, 3600)
      setUrls(Object.fromEntries((firmadas ?? []).filter((f) => f.signedUrl && f.path).map((f) => [f.path as string, f.signedUrl as string])))
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar() }, [vehiculoId])

  async function guardarLista(lista: string[]) {
    const { error: err } = await supabase!.from('vehiculo').update({ fotos: lista }).eq('id', vehiculoId)
    if (err) throw new Error(err.message)
  }

  async function subir(archivos: FileList) {
    setError(null)
    const nuevas: string[] = []
    try {
      for (const [i, f] of [...archivos].entries()) {
        setOcupado(`Subiendo ${i + 1} de ${archivos.length}…`)
        nuevas.push(await subirArchivo(vehiculoId, 'fotos', await reducirFoto(f), f.name.replace(/\.\w+$/, '.jpg')))
      }
      await guardarLista([...fotos, ...nuevas])
    } catch (e) {
      await quitarArchivos(nuevas)
      setError(`No se pudieron subir las fotos: ${(e as Error).message}`)
    }
    setOcupado(null)
    cargar()
  }

  async function quitar(ruta: string) {
    if (!window.confirm('¿Quitar esta foto?')) return
    setError(null)
    try {
      await guardarLista(fotos.filter((f) => f !== ruta))
      await quitarArchivos([ruta])
    } catch (e) { setError((e as Error).message) }
    cargar()
  }

  async function portada(ruta: string) {
    setError(null)
    try { await guardarLista([ruta, ...fotos.filter((f) => f !== ruta)]) } catch (e) { setError((e as Error).message) }
    cargar()
  }

  return (
    <div className="card">
      <div className="card-encabezado-acciones">
        <div className="card-titulo">Fotos ({fotos.length})</div>
        {puedeEditar && (
          <label className={`btn btn-secundario btn-chico${ocupado ? ' deshabilitado' : ''}`}>
            {ocupado ?? '+ Agregar fotos'}
            <input type="file" hidden multiple accept="image/*" disabled={Boolean(ocupado)}
              onChange={(e) => { if (e.target.files?.length) subir(e.target.files); e.target.value = '' }} />
          </label>
        )}
      </div>
      {error && <div style={{ marginBottom: 12 }}><Alerta>{error}</Alerta></div>}
      {fotos.length === 0 ? (
        <p className="texto-suave" style={{ margin: 0 }}>Sin fotos. Al adquirir desde una subasta con Dropbox llegan solas; también puedes subirlas aquí.</p>
      ) : (
        <div className="galeria">
          {fotos.map((ruta, i) => (
            <div key={ruta} className="galeria-foto">
              {urls[ruta] ? <a href={urls[ruta]} target="_blank" rel="noreferrer"><img src={urls[ruta]} alt="" /></a> : <span className="texto-suave">…</span>}
              {i === 0 && <span className="galeria-portada">Portada</span>}
              {puedeEditar && (
                <span className="galeria-botones">
                  {i > 0 && <button className="btn-link" onClick={() => portada(ruta)}>Portada</button>}
                  <button className="btn-link peligro" onClick={() => quitar(ruta)}>Quitar</button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
