import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { buscarCarpetaUnidad, conectarDropbox, descargarDropbox, dropboxConectado, miniaturaDropbox, type CarpetaUnidad, type EntradaDropbox } from '../lib/dropbox'
import { cargarPdfjs } from '../lib/contratoPdf'
import { miniatura } from '../lib/miniatura'
import { useParametros } from '../lib/parametros'
import { Modal, Alerta, Cargando } from './Ui'

/**
 * Conecta Dropbox desde donde esté el usuario (sale a Dropbox y regresa a la
 * misma pantalla). Si aún no hay App key, manda a Configuración.
 */
export function ConectarDropbox({ texto = 'Conectar Dropbox' }: { texto?: string }) {
  const { dropbox_app_key } = useParametros()
  const [error, setError] = useState<string | null>(() => {
    const e = sessionStorage.getItem('dropbox:error')
    sessionStorage.removeItem('dropbox:error')
    return e
  })
  const [abriendo, setAbriendo] = useState(false)
  if (!dropbox_app_key) return <span className="texto-suave">Falta la App key de Dropbox: ponla en <Link to="/configuracion">Configuración → General</Link>.</span>
  return (
    <>
      <button type="button" className="btn btn-primario" disabled={abriendo}
        onClick={() => { setAbriendo(true); conectarDropbox(dropbox_app_key).catch((e) => { setAbriendo(false); setError((e as Error).message) }) }}>
        {abriendo ? 'Abriendo Dropbox…' : texto}
      </button>
      {error && <span className="texto-peligro">{error}</span>}
    </>
  )
}

/** Descargas completas ya hechas en esta ventana (fotos y PDFs), para no repetirlas al ir y venir. */
function useArchivos(enlace: string) {
  const cache = useRef(new Map<string, Promise<Blob>>())
  useEffect(() => () => cache.current.clear(), [enlace])
  return (ruta: string) => {
    let p = cache.current.get(ruta)
    if (!p) {
      p = descargarDropbox(enlace, ruta)
      p.catch(() => cache.current.delete(ruta))
      cache.current.set(ruta, p)
    }
    return p
  }
}

function useObjectUrl(blob: Blob | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) { setUrl(null); return }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

type Vista = { tipo: 'foto'; indice: number } | { tipo: 'pdf'; archivo: EntradaDropbox; titulo: string }

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
  const [vista, setVista] = useState<Vista | null>(null)
  const archivo = useArchivos(enlace)

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

  const documentos = carpeta ? [
    carpeta.inspeccion && { archivo: carpeta.inspeccion, titulo: 'Hoja de inspección' },
    carpeta.repuve && { archivo: carpeta.repuve, titulo: 'REPUVE' },
  ].filter((d): d is { archivo: EntradaDropbox; titulo: string } => Boolean(d)) : []

  return (
    <Modal titulo={`Fotos · ${titulo}`} subtitulo={`Torre ${torre}${stock ? ` · stock ${stock}` : ''} · desde Dropbox`} ancho={980} onClose={onClose}>
      {!conectado ? (
        <div className="form">
          <Alerta tipo="aviso">
            Para ver las fotos aquí, conecta Dropbox en este navegador (se hace una sola vez; te pide entrar a tu cuenta de Dropbox y regresa a esta pantalla).
            {' '}Mientras tanto puedes <a href={enlace} target="_blank" rel="noreferrer">abrir la carpeta de la subasta en Dropbox ↗</a>.
          </Alerta>
          <div className="form-acciones" style={{ alignItems: 'center' }}><ConectarDropbox /></div>
        </div>
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
          {documentos.length > 0 && (
            <>
              <div className="card-titulo" style={{ fontSize: 15 }}>Documentos</div>
              <div className="galeria" style={{ marginBottom: 16 }}>
                {documentos.map((d) => (
                  <MiniaturaPdf key={d.archivo.ruta} titulo={d.titulo} obtener={() => archivo(d.archivo.ruta)}
                    onClick={() => setVista({ tipo: 'pdf', archivo: d.archivo, titulo: d.titulo })} />
                ))}
              </div>
            </>
          )}
          <div className="fotos-acciones">
            <span className="card-titulo" style={{ fontSize: 15, margin: 0 }}>Fotos</span>
            <span className="texto-suave">{carpeta.fotos.length} fotos · clic para verla en grande</span>
          </div>
          <div className="galeria">
            {carpeta.fotos.map((f, i) => (
              <button key={f.ruta} className="galeria-foto" onClick={() => setVista({ tipo: 'foto', indice: i })} title={f.nombre}>
                {miniaturas[f.ruta] ? <img src={miniaturas[f.ruta]} alt={f.nombre} loading="lazy" /> : <span className="texto-suave">…</span>}
              </button>
            ))}
          </div>
        </>
      )}
      {vista?.tipo === 'foto' && carpeta && (
        <VisorFotos fotos={carpeta.fotos} indice={vista.indice} miniaturas={miniaturas} obtener={archivo}
          onCambiar={(indice) => setVista({ tipo: 'foto', indice })} onClose={() => setVista(null)} />
      )}
      {vista?.tipo === 'pdf' && (
        <VisorPdf titulo={vista.titulo} archivo={vista.archivo} obtener={archivo} onClose={() => setVista(null)} />
      )}
    </Modal>
  )
}

/** Tarjeta de un PDF con la imagen de su primera página. */
function MiniaturaPdf({ titulo, obtener, onClick }: { titulo: string; obtener: () => Promise<Blob>; onClick: () => void }) {
  const [img, setImg] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let vivo = true
    obtener().then((b) => miniatura(b, 320)).then((m) => { if (vivo) setImg(m) }).catch(() => { if (vivo) setImg(null) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <button className="galeria-foto galeria-doc" onClick={onClick} title={titulo}>
      {img ? <img src={img} alt={titulo} /> : <span className="texto-suave">{img === null ? 'PDF' : '…'}</span>}
      <span className="galeria-portada">{titulo}</span>
    </button>
  )
}

/** Capa a pantalla completa por encima del modal; Esc la cierra sin cerrar el modal. */
function Visor({ titulo, pie, onClose, onTecla, children }: {
  titulo: string
  pie?: React.ReactNode
  onClose: () => void
  onTecla?: (e: KeyboardEvent) => void
  children: React.ReactNode
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() } else onTecla?.(e)
    }
    // En captura: llega antes que el Esc del modal de abajo.
    window.addEventListener('keydown', f, true)
    return () => window.removeEventListener('keydown', f, true)
  }, [onClose, onTecla])
  return (
    <div className="visor" onMouseDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose() }} role="dialog" aria-label={titulo}>
      <div className="visor-barra">
        <span className="visor-titulo">{titulo}</span>
        <div className="visor-acciones">
          {pie}
          <button className="btn btn-secundario btn-chico" onClick={onClose}>Cerrar ✕</button>
        </div>
      </div>
      {children}
    </div>
  )
}

function VisorFotos({ fotos, indice, miniaturas, obtener, onCambiar, onClose }: {
  fotos: EntradaDropbox[]
  indice: number
  miniaturas: Record<string, string>
  obtener: (ruta: string) => Promise<Blob>
  onCambiar: (i: number) => void
  onClose: () => void
}) {
  const foto = fotos[indice]
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const url = useObjectUrl(blob)
  const ir = (d: number) => onCambiar((indice + d + fotos.length) % fotos.length)

  useEffect(() => {
    let vivo = true
    setBlob(null)
    setError(null)
    obtener(foto.ruta).then((b) => { if (vivo) setBlob(b) }).catch((e) => { if (vivo) setError((e as Error).message) })
    // Precarga la siguiente para que el cambio sea inmediato.
    if (fotos.length > 1) obtener(fotos[(indice + 1) % fotos.length].ruta).catch(() => {})
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foto.ruta])

  return (
    <Visor titulo={`Foto ${indice + 1} de ${fotos.length}`} onClose={onClose}
      onTecla={(e) => { if (e.key === 'ArrowRight') ir(1); if (e.key === 'ArrowLeft') ir(-1) }}
      pie={url && <a className="btn btn-secundario btn-chico" href={url} download={foto.nombre}>Descargar</a>}>
      <div className="visor-cuerpo">
        {fotos.length > 1 && <button className="visor-flecha izq" onClick={() => ir(-1)} aria-label="Anterior">‹</button>}
        {error ? <Alerta>{error}</Alerta>
          : <img className="visor-img" src={url ?? miniaturas[foto.ruta]} alt={foto.nombre} style={url ? undefined : { filter: 'blur(2px)' }} />}
        {fotos.length > 1 && <button className="visor-flecha der" onClick={() => ir(1)} aria-label="Siguiente">›</button>}
      </div>
    </Visor>
  )
}

/** PDF dibujado página por página con pdf.js (funciona también en celular, donde un PDF incrustado no se ve). */
function VisorPdf({ titulo, archivo, obtener, onClose }: {
  titulo: string
  archivo: EntradaDropbox
  obtener: (ruta: string) => Promise<Blob>
  onClose: () => void
}) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [paginas, setPaginas] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const url = useObjectUrl(blob)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const b = await obtener(archivo.ruta)
      if (!vivo) return
      setBlob(b)
      const pdfjs = await cargarPdfjs()
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await b.arrayBuffer()) }).promise
      for (let n = 1; n <= doc.numPages && vivo; n++) {
        const pagina = await doc.getPage(n)
        const base = pagina.getViewport({ scale: 1 })
        const viewport = pagina.getViewport({ scale: Math.min(2, 1400 / base.width) })
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        await pagina.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
        const img = canvas.toDataURL('image/jpeg', 0.85)
        if (vivo) setPaginas((p) => [...p, img])
      }
    })().catch((e) => { if (vivo) setError((e as Error).message) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivo.ruta])

  return (
    <Visor titulo={titulo} onClose={onClose}
      pie={url && <>
        <a className="btn btn-secundario btn-chico" href={url} target="_blank" rel="noreferrer">Abrir en otra pestaña</a>
        <a className="btn btn-secundario btn-chico" href={url} download={archivo.nombre}>Descargar</a>
      </>}>
      <div className="visor-pdf">
        {error ? <Alerta>{error}</Alerta> : paginas.length === 0 ? <Cargando /> : paginas.map((p, i) => <img key={i} src={p} alt={`${titulo} · página ${i + 1}`} />)}
      </div>
    </Visor>
  )
}
