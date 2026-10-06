import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { buscarCarpetaUnidad, descargarDropbox, dropboxConectado, miniaturaDropbox, type CarpetaUnidad } from '../lib/dropbox'
import { Modal, Alerta, Cargando } from './Ui'

/** Abre un Blob en otra pestaña (la pestaña se abre antes del await para que no la bloqueen). */
async function abrirBlob(obtener: () => Promise<Blob>) {
  const ventana = window.open('', '_blank')
  try {
    const url = URL.createObjectURL(await obtener())
    if (ventana) ventana.location.href = url
    else window.location.href = url
  } catch (e) {
    ventana?.close()
    throw e
  }
}

/**
 * Fotos, hoja de inspección y REPUVE de una unidad, leídos directo de la
 * carpeta compartida de Dropbox de la subasta (no se guardan: solo se ven).
 */
export function FotosDropboxModal({ enlace, torre, stock, titulo, onClose }: {
  enlace: string
  torre: string
  stock: string | null
  titulo: string
  onClose: () => void
}) {
  const conectado = dropboxConectado()
  const [carpeta, setCarpeta] = useState<CarpetaUnidad | null | undefined>(undefined)
  const [miniaturas, setMiniaturas] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!conectado) return
    let vivo = true
    const urls: string[] = []
    buscarCarpetaUnidad(enlace, torre, stock)
      .then(async (c) => {
        if (!vivo) return
        setCarpeta(c)
        if (!c) return
        // De 4 en 4 para no saturar la API de Dropbox.
        for (let i = 0; i < c.fotos.length && vivo; i += 4) {
          const lote = await Promise.all(c.fotos.slice(i, i + 4).map(async (f) => {
            try { const u = URL.createObjectURL(await miniaturaDropbox(enlace, f.ruta)); urls.push(u); return [f.ruta, u] as const } catch { return null }
          }))
          if (vivo) setMiniaturas((m) => ({ ...m, ...Object.fromEntries(lote.filter((x): x is readonly [string, string] => Boolean(x))) }))
        }
      })
      .catch((e) => { if (vivo) setError((e as Error).message) })
    return () => { vivo = false; urls.forEach((u) => URL.revokeObjectURL(u)) }
  }, [conectado, enlace, torre, stock])

  const abrir = (ruta: string) => abrirBlob(() => descargarDropbox(enlace, ruta)).catch((e) => setError((e as Error).message))

  return (
    <Modal titulo={`Fotos · ${titulo}`} subtitulo={`Torre ${torre}${stock ? ` · stock ${stock}` : ''} · desde Dropbox`} ancho={980} onClose={onClose}>
      {!conectado ? (
        <Alerta tipo="aviso">
          Dropbox no está conectado en este navegador. Conéctalo en <Link to="/configuracion" onClick={onClose}>Configuración → General</Link>.
          {' '}Mientras tanto puedes <a href={enlace} target="_blank" rel="noreferrer">abrir la carpeta de la subasta en Dropbox ↗</a>.
        </Alerta>
      ) : error ? (
        <Alerta>{error}</Alerta>
      ) : carpeta === undefined ? (
        <Cargando />
      ) : carpeta === null ? (
        <Alerta tipo="aviso">
          No hay una carpeta para la torre {torre} en esta subasta de Dropbox. <a href={enlace} target="_blank" rel="noreferrer">Abrir la carpeta ↗</a>
        </Alerta>
      ) : (
        <>
          {!carpeta.coincideStock && (
            <div style={{ marginBottom: 12 }}>
              <Alerta tipo="aviso">
                La carpeta {carpeta.ruta} no menciona el stock {stock}: puede ser de otra unidad, de otro patio o de otra fecha. Revisa antes de usarla.
              </Alerta>
            </div>
          )}
          <div className="fotos-acciones">
            {carpeta.inspeccion && <button className="btn btn-secundario btn-chico" onClick={() => abrir(carpeta.inspeccion!.ruta)}>Hoja de inspección</button>}
            {carpeta.repuve && <button className="btn btn-secundario btn-chico" onClick={() => abrir(carpeta.repuve!.ruta)}>REPUVE</button>}
            <span className="texto-suave">{carpeta.fotos.length} fotos · clic para verla completa</span>
          </div>
          <div className="galeria">
            {carpeta.fotos.map((f) => (
              <button key={f.ruta} className="galeria-foto" onClick={() => abrir(f.ruta)} title={f.nombre}>
                {miniaturas[f.ruta] ? <img src={miniaturas[f.ruta]} alt={f.nombre} loading="lazy" /> : <span className="texto-suave">…</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}
