import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { leerListado, type Listado } from '../lib/contratoPdf'
import { useParametros } from '../lib/parametros'
import { mxn, km, fecha, TRANSMISION_LABEL } from '../lib/helpers'
import { Modal, Campo, Alerta, Badge } from './Ui'
import type { Subasta } from '../types'

/**
 * Carga rápida del "Listado de Unidades a Subastar": lee el PDF, muestra lo
 * detectado y crea la subasta (o usa la que ya existe con esa plataforma,
 * fecha y locación) más una evaluación por unidad elegida, en una sola
 * inserción. Las que ya están en esa subasta (mismo stock) no se duplican.
 */
export function CargaListadoModal({ subastas, onClose, onGuardado }: {
  subastas: Subasta[]
  onClose: () => void
  onGuardado: (subastaId: number) => void
}) {
  const { margen_deseado } = useParametros()
  const [listado, setListado] = useState<Listado | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [plataforma, setPlataforma] = useState('Prosubastas')
  const [fechaSubasta, setFechaSubasta] = useState('')
  const [locacion, setLocacion] = useState('')
  const [enlaceFotos, setEnlaceFotos] = useState('')
  const [elegidas, setElegidas] = useState<Set<string>>(new Set())
  const [yaCargadas, setYaCargadas] = useState<Set<string>>(new Set())
  const [compradas, setCompradas] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const existente = useMemo(() => subastas.find((s) =>
    s.plataforma.trim().toLowerCase() === plataforma.trim().toLowerCase()
    && s.fecha === fechaSubasta
    && (s.patio_origen ?? '').trim().toLowerCase() === locacion.trim().toLowerCase()), [subastas, plataforma, fechaSubasta, locacion])

  async function leer(archivo: File) {
    setLeyendo(true)
    setError(null)
    try {
      const l = await leerListado(archivo)
      if (l.unidades.length === 0) {
        setError('No se encontraron unidades en el PDF. ¿Es un "Listado de Unidades a Subastar"?')
        setLeyendo(false)
        return
      }
      setListado(l)
      setFechaSubasta(l.fechaSubasta)
      setLocacion(l.locacion)
      // Ya en el sistema: stock en una subasta con esa fecha, o serie de una unidad comprada.
      const stocks = l.unidades.map((u) => u.stock)
      const vins = l.unidades.map((u) => u.vin).filter(Boolean)
      const [ev, veh] = await Promise.all([
        supabase!.from('evaluacion_puja').select('stock, subasta:subasta_id(fecha)').in('stock', stocks),
        supabase!.from('vehiculo').select('vin').in('vin', vins),
      ])
      const enSubasta = new Set(((ev.data ?? []) as unknown as { stock: string; subasta: { fecha: string } | null }[])
        .filter((e) => e.subasta?.fecha === l.fechaSubasta).map((e) => e.stock))
      const vinsComprados = new Set(((veh.data ?? []) as { vin: string }[]).map((v) => v.vin))
      setYaCargadas(enSubasta)
      setCompradas(new Set(l.unidades.filter((u) => vinsComprados.has(u.vin)).map((u) => u.stock)))
      setElegidas(new Set(l.unidades.filter((u) => !enSubasta.has(u.stock) && !vinsComprados.has(u.vin)).map((u) => u.stock)))
    } catch (err) {
      setError(`No se pudo leer el PDF: ${(err as Error).message}`)
    }
    setLeyendo(false)
  }

  const alternar = (stock: string) => setElegidas((s) => {
    const n = new Set(s)
    if (n.has(stock)) n.delete(stock); else n.add(stock)
    return n
  })
  const disponibles = listado?.unidades.filter((u) => !yaCargadas.has(u.stock)) ?? []
  const todas = disponibles.length > 0 && disponibles.every((u) => elegidas.has(u.stock))

  async function guardar() {
    if (!supabase || !listado) return
    if (!plataforma.trim() || !fechaSubasta) { setError('Falta la plataforma o la fecha de la subasta.'); return }
    const unidades = listado.unidades.filter((u) => elegidas.has(u.stock) && !yaCargadas.has(u.stock))
    if (unidades.length === 0) { setError('Elige al menos una unidad.'); return }
    setGuardando(true)
    setError(null)

    let subastaId = existente?.id ?? null
    let creada = false
    if (!subastaId) {
      const { data, error: err } = await supabase.from('subasta').insert({
        plataforma: plataforma.trim(), fecha: fechaSubasta, patio_origen: locacion.trim() || null,
        enlace_fotos: enlaceFotos.trim() || null,
      }).select('id').single()
      if (err || !data) { setGuardando(false); setError(err?.message ?? 'No se pudo crear la subasta.'); return }
      subastaId = data.id as number
      creada = true
    } else if (enlaceFotos.trim() && !existente?.enlace_fotos) {
      await supabase.from('subasta').update({ enlace_fotos: enlaceFotos.trim() }).eq('id', subastaId)
    }

    const { error: errEv } = await supabase.from('evaluacion_puja').insert(unidades.map((u) => ({
      subasta_id: subastaId,
      marca: u.marca, modelo: u.modelo, anio: Number(u.anio) || new Date().getFullYear(), version: u.version || null,
      torre: u.torre, stock: u.stock, vin: u.vin || null, color: u.color || null, puertas: u.puertas,
      kilometraje_llegada: u.kilometraje, equipamiento: u.equipamiento || null, transmision: u.transmision || null,
      vendedor: u.vendedor || null, valor_factura: u.valorFactura, fecha_factura: u.fechaFactura || null,
      info_documentos: u.documentos || null,
      costo_reparacion_estimado: 0, precio_venta_esperado: 0, margen_deseado: margen_deseado / 100,
    })))
    if (errEv) {
      if (creada) await supabase.from('subasta').delete().eq('id', subastaId)  // no dejar una subasta vacía
      setGuardando(false)
      setError(`No se pudieron guardar las unidades: ${errEv.message}`)
      return
    }
    setGuardando(false)
    onGuardado(subastaId)
  }

  return (
    <Modal titulo="Carga rápida desde el listado de la subasta" subtitulo="Sube el PDF «Listado de Unidades a Subastar»." ancho={1040} onClose={onClose}>
      {!listado ? (
        <div className="form">
          <Campo label="Archivo PDF del listado">
            <input className="input" type="file" accept="application/pdf" disabled={leyendo}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) leer(f) }} />
          </Campo>
          {leyendo && <p className="texto-suave">Leyendo el listado…</p>}
          {error && <Alerta>{error}</Alerta>}
        </div>
      ) : (
        <div className="form">
          <div className="form-grid">
            <Campo label="Plataforma"><input className="input" value={plataforma} onChange={(e) => setPlataforma(e.target.value)} /></Campo>
            <Campo label="Fecha de la subasta"><input className="input" type="date" value={fechaSubasta} onChange={(e) => setFechaSubasta(e.target.value)} /></Campo>
            <Campo label="Locación"><input className="input" value={locacion} onChange={(e) => setLocacion(e.target.value)} /></Campo>
          </div>
          <Campo label="Enlace de Dropbox con las fotos (opcional)" ayuda="La carpeta compartida de la subasta. Las fotos se ligan a cada unidad por su número de stock.">
            <input className="input" placeholder="https://www.dropbox.com/scl/fo/…" value={enlaceFotos} onChange={(e) => setEnlaceFotos(e.target.value)} />
          </Campo>
          <Alerta tipo="info">
            {existente
              ? <>Las unidades se agregan a la subasta que ya existe: {existente.plataforma} · {fecha(existente.fecha)}{existente.patio_origen ? ` · ${existente.patio_origen}` : ''}.</>
              : <>Se creará la subasta {plataforma} · {fechaSubasta ? fecha(fechaSubasta) : 'sin fecha'}{locacion ? ` · ${locacion}` : ''}.</>}
            {' '}{listado.unidades.length} unidades en el listado{listado.fechaReporte ? ` (reporte del ${fecha(listado.fechaReporte)})` : ''}.
          </Alerta>

          <div className="tabla-wrap tabla-alta">
            <table className="tabla">
              <thead>
                <tr>
                  <th className="col-check"><input type="checkbox" aria-label="Elegir todas" checked={todas}
                    onChange={() => setElegidas(todas ? new Set() : new Set(disponibles.map((u) => u.stock)))} /></th>
                  <th>Torre</th><th>Unidad</th><th>Km</th><th>Color</th><th>Transmisión</th><th className="num">Factura</th>
                </tr>
              </thead>
              <tbody>
                {listado.unidades.map((u) => {
                  const cargada = yaCargadas.has(u.stock)
                  return (
                    <tr key={u.stock} className={cargada ? 'inactivo' : ''}>
                      <td className="col-check">
                        <input type="checkbox" disabled={cargada} checked={elegidas.has(u.stock)} onChange={() => alternar(u.stock)} aria-label={`Elegir ${u.torre}`} />
                      </td>
                      <td className="nowrap">
                        {u.torre}
                        <span className="unidad-folio">Stock {u.stock}</span>
                      </td>
                      <td>
                        <span className="unidad-nombre">{u.marca} {u.modelo} {u.anio}</span>
                        <span className="unidad-folio">{[u.version, u.vin].filter(Boolean).join(' · ')}</span>
                        {cargada && <Badge tono="neutral">Ya está en esta subasta</Badge>}
                        {compradas.has(u.stock) && <Badge tono="aviso">Esa serie ya es una unidad nuestra</Badge>}
                      </td>
                      <td className="nowrap">{km(u.kilometraje)}</td>
                      <td>{u.color || '—'}</td>
                      <td>{u.transmision ? TRANSMISION_LABEL[u.transmision] : '—'}</td>
                      <td className="num">
                        {mxn(u.valorFactura)}
                        {u.fechaFactura && <span className="unidad-folio">{fecha(u.fechaFactura)}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {error && <Alerta>{error}</Alerta>}
          <div className="form-acciones">
            <button type="button" className="btn btn-secundario" onClick={() => setListado(null)} disabled={guardando}>Cambiar archivo</button>
            <button type="button" className="btn btn-primario" onClick={guardar} disabled={guardando || elegidas.size === 0}>
              {guardando ? 'Guardando…' : `Guardar ${[...elegidas].filter((s) => !yaCargadas.has(s)).length} unidades`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
