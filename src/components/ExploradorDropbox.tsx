import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  dropboxConectado, miniaturaDropbox, unidadesDeVendedor, vendedoresDropbox,
  type EntradaDropbox, type UnidadDropbox,
} from '../lib/dropbox'
import { Modal, Alerta, Cargando, Badge } from './Ui'
import { FotosDropboxModal } from './FotosDropbox'
import type { EvaluacionPuja } from '../types'

/**
 * Todo el Dropbox de una subasta, sin necesidad del listado: carpetas por
 * vendedor y, dentro, cada unidad con su foto de portada, torre y stock.
 * "Evaluar" la agrega a Posibles ofertas con torre y stock ya llenos.
 */
export function ExploradorDropbox({ enlace, evaluaciones, onEvaluar, onClose }: {
  enlace: string
  evaluaciones: EvaluacionPuja[]
  onEvaluar: (u: UnidadDropbox) => void
  onClose: () => void
}) {
  const conectado = dropboxConectado()
  const [vendedores, setVendedores] = useState<{ carpeta: EntradaDropbox; codigo: string }[] | null>(null)
  const [vendedor, setVendedor] = useState<string | null>(null)
  const [unidades, setUnidades] = useState<UnidadDropbox[]>([])
  const [cargandoUnidades, setCargandoUnidades] = useState(false)
  const [portadas, setPortadas] = useState<Record<string, string>>({})
  const [viendo, setViendo] = useState<UnidadDropbox | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!conectado) return
    vendedoresDropbox(enlace)
      .then((v) => { setVendedores(v); setVendedor(v[0]?.carpeta.ruta ?? null) })
      .catch((e) => setError((e as Error).message))
  }, [conectado, enlace])

  useEffect(() => {
    if (!vendedor) return
    let vivo = true
    const urls: string[] = []
    setUnidades([])
    setCargandoUnidades(true)
    unidadesDeVendedor(enlace, vendedor, (u) => {
      if (!vivo) return
      setUnidades((lista) => [...lista, u].sort((a, b) => a.carpeta.nombre.localeCompare(b.carpeta.nombre, 'es', { numeric: true })))
      const primera = u.fotos[0]
      if (primera) miniaturaDropbox(enlace, primera.ruta)
        .then((b) => { const url = URL.createObjectURL(b); urls.push(url); if (vivo) setPortadas((p) => ({ ...p, [u.carpeta.ruta]: url })) })
        .catch(() => { /* sin portada: se muestra el recuadro vacío */ })
    })
      .catch((e) => { if (vivo) setError((e as Error).message) })
      .finally(() => { if (vivo) setCargandoUnidades(false) })
    return () => { vivo = false; urls.forEach((u) => URL.revokeObjectURL(u)) }
  }, [enlace, vendedor])

  const evaluacionDe = (u: UnidadDropbox) => evaluaciones.find((e) =>
    (u.stock && e.stock === u.stock) || (!e.stock && e.torre?.toUpperCase() === u.torre.toUpperCase()))

  if (viendo) {
    return (
      <FotosDropboxModal
        enlace={enlace}
        torre={viendo.torre}
        stock={viendo.stock}
        titulo={evaluacionDe(viendo) ? `${evaluacionDe(viendo)!.marca} ${evaluacionDe(viendo)!.modelo} ${evaluacionDe(viendo)!.anio}` : viendo.carpeta.nombre}
        onClose={() => setViendo(null)}
      />
    )
  }

  return (
    <Modal titulo="Unidades en Dropbox" subtitulo="Carpeta compartida de la subasta" ancho={1100} onClose={onClose}>
      {!conectado ? (
        <Alerta tipo="aviso">
          Dropbox no está conectado en este navegador. Conéctalo en <Link to="/configuracion" onClick={onClose}>Configuración → General</Link>.
        </Alerta>
      ) : error ? (
        <Alerta>{error}</Alerta>
      ) : !vendedores ? (
        <Cargando />
      ) : vendedores.length === 0 ? (
        <Alerta tipo="aviso">La carpeta no tiene subcarpetas. <a href={enlace} target="_blank" rel="noreferrer">Abrirla en Dropbox ↗</a></Alerta>
      ) : (
        <>
          <div className="chips" style={{ marginBottom: 14 }}>
            {vendedores.map((v) => (
              <button key={v.carpeta.ruta} className={`chip${vendedor === v.carpeta.ruta ? ' activa' : ''}`} onClick={() => setVendedor(v.carpeta.ruta)}>
                {v.codigo}
              </button>
            ))}
          </div>
          {cargandoUnidades && unidades.length === 0 && <Cargando />}
          <div className="galeria galeria-unidades">
            {unidades.map((u) => {
              const ev = evaluacionDe(u)
              return (
                <div key={u.carpeta.ruta} className="tarjeta-unidad">
                  <button className="galeria-foto" onClick={() => setViendo(u)} title="Ver fotos">
                    {portadas[u.carpeta.ruta] ? <img src={portadas[u.carpeta.ruta]} alt="" /> : <span className="texto-suave">{u.fotos.length ? '…' : 'Sin fotos'}</span>}
                  </button>
                  <div className="tarjeta-unidad-pie">
                    <div>
                      <strong>{u.torre}</strong>
                      <span className="unidad-folio">{u.stock ? `Stock ${u.stock}` : 'Sin stock'} · {u.fotos.length} {u.fotos.length === 1 ? 'foto' : 'fotos'}</span>
                    </div>
                    {ev
                      ? <Badge tono="ok">{ev.marca} {ev.modelo}</Badge>
                      : <button className="btn btn-primario btn-chico" onClick={() => onEvaluar(u)}>Evaluar</button>}
                  </div>
                </div>
              )
            })}
          </div>
          {cargandoUnidades && unidades.length > 0 && <p className="texto-suave">Cargando más unidades…</p>}
        </>
      )}
    </Modal>
  )
}
