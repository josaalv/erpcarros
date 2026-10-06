import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCatalogos } from '../lib/catalogos'
import { useBorrador } from '../lib/useBorrador'
import { useParametros } from '../lib/parametros'
import { mxn, porcentaje, fecha, km, hoyISO, numeroONull, etiqueta, RESULTADO_EVALUACION, TRANSMISION_LABEL } from '../lib/helpers'
import { Modal, FormBotones, PageHeader, Campo, Alerta, Cargando, EtiquetaBadge } from '../components/Ui'
import { CargaListadoModal } from '../components/CargaListado'
import { FotosDropboxModal } from '../components/FotosDropbox'
import { ExploradorDropbox } from '../components/ExploradorDropbox'
import { copiarDeDropbox } from '../lib/dropboxUnidad'
import { dropboxConectado } from '../lib/dropbox'
import type { Subasta, EvaluacionPuja, RoiSegmento } from '../types'

/**
 * Etapa 1: unidades que todavía no son nuestras. "Adquirir" es la única
 * puerta a Inventario: crea vehiculo + compra y marca la evaluación ganada.
 */
export default function PosiblesOfertas() {
  const navigate = useNavigate()
  const { estados, ubicaciones, cargando: cargandoCatalogos } = useCatalogos()
  const [subastas, setSubastas] = useState<Subasta[]>([])
  const [subastaId, setSubastaId] = useState<number | null>(null)
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionPuja[]>([])
  const [roiSegmento, setRoiSegmento] = useState<RoiSegmento[]>([])
  const [cargando, setCargando] = useState(true)
  const [subastaModal, setSubastaModal] = useState<Subasta | 'nueva' | null>(null)
  const [evaluacionModal, setEvaluacionModal] = useState<EvaluacionPuja | 'nueva' | null>(null)
  const [adquiriendo, setAdquiriendo] = useState<EvaluacionPuja | null>(null)
  const [cargandoListado, setCargandoListado] = useState(false)
  const [viendoFotos, setViendoFotos] = useState<EvaluacionPuja | null>(null)
  const [explorando, setExplorando] = useState(false)
  const [nuevaDesdeDropbox, setNuevaDesdeDropbox] = useState<{ torre: string; stock: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function recargar(subastaSeleccionada?: number | null) {
    if (!supabase) return
    const [s, r] = await Promise.all([
      supabase.from('subasta').select('*').order('fecha', { ascending: false }),
      supabase.from('v_roi_segmento').select('*'),
    ])
    const lista = (s.data ?? []) as Subasta[]
    setSubastas(lista)
    setRoiSegmento((r.data ?? []) as RoiSegmento[])

    const pedido = subastaSeleccionada !== undefined ? subastaSeleccionada : subastaId
    const idActivo = lista.some((x) => x.id === pedido) ? pedido! : (lista[0]?.id ?? null)
    setSubastaId(idActivo)

    if (idActivo) {
      const { data } = await supabase.from('evaluacion_puja').select('*').eq('subasta_id', idActivo).order('marca')
      setEvaluaciones((data ?? []) as EvaluacionPuja[])
    } else {
      setEvaluaciones([])
    }
    setCargando(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { recargar() }, [])

  async function cambiarResultado(ev: EvaluacionPuja, resultado: EvaluacionPuja['resultado']) {
    if (!supabase) return
    setError(null)
    const { error } = await supabase.from('evaluacion_puja').update({ resultado }).eq('id', ev.id)
    if (error) setError(error.message)
    recargar(subastaId)
  }

  async function eliminarEvaluacion(ev: EvaluacionPuja) {
    if (!supabase || !window.confirm(`¿Eliminar la evaluación de ${ev.marca} ${ev.modelo} ${ev.anio}?`)) return
    setError(null)
    const { error } = await supabase.from('evaluacion_puja').delete().eq('id', ev.id)
    if (error) setError(error.message)
    recargar(subastaId)
  }

  async function eliminarSubasta(s: Subasta) {
    if (!supabase || !window.confirm(`¿Eliminar la subasta ${s.plataforma} del ${fecha(s.fecha)}?`)) return
    setError(null)
    const { error } = await supabase.from('subasta').delete().eq('id', s.id)
    if (error) { setError('No se puede eliminar una subasta que todavía tiene vehículos evaluados. Elimínalos primero.'); return }
    recargar(null)
  }

  if (cargando || cargandoCatalogos) return <Cargando />

  const subasta = subastas.find((s) => s.id === subastaId) ?? null
  const pendientes = evaluaciones.filter((e) => e.resultado === 'pendiente')
  const decididas = evaluaciones.filter((e) => e.resultado !== 'pendiente')
  const porEvaluar = pendientes.filter((e) => !e.precio_venta_esperado).length

  const porMarca = pendientes.reduce<Record<string, EvaluacionPuja[]>>((acc, e) => {
    (acc[e.marca] ??= []).push(e)
    return acc
  }, {})
  Object.values(porMarca).forEach((lista) => lista.sort((a, b) => (a.torre ?? '').localeCompare(b.torre ?? '')))

  return (
    <div>
      <PageHeader
        titulo="Posibles ofertas"
        descripcion="Vehículos que te interesan en una subasta. Calcula cuánto pujar y, si lo ganas, adquiérelo para pasarlo a Inventario."
        acciones={
          <>
            <button className="btn btn-secundario" onClick={() => setSubastaModal('nueva')}>+ Nueva subasta</button>
            <button className="btn btn-primario" onClick={() => setCargandoListado(true)}>Cargar listado (PDF)</button>
          </>
        }
      />

      {error && <div style={{ marginBottom: 16 }}><Alerta>{error}</Alerta></div>}

      {subastas.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="texto-suave" style={{ marginTop: 0 }}>Todavía no hay subastas registradas.</p>
          <button className="btn btn-primario" onClick={() => setSubastaModal('nueva')}>Registrar la primera subasta</button>
        </div>
      ) : (
        <div className="chips">
          {subastas.map((s) => (
            <button key={s.id} className={`chip${subastaId === s.id ? ' activa' : ''}`}
              onClick={() => { setCargando(true); recargar(s.id) }}>
              {s.plataforma} · {fecha(s.fecha)}
            </button>
          ))}
        </div>
      )}

      {subasta && (
        <>
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="seccion-header" style={{ marginBottom: 0 }}>
              <div>
                <div className="card-titulo">{subasta.plataforma} · {fecha(subasta.fecha)}</div>
                <p className="card-sub" style={{ margin: 0 }}>
                  {[subasta.lote && `Lote ${subasta.lote}`, subasta.patio_origen && `Patio ${subasta.patio_origen}`].filter(Boolean).join(' · ') || 'Sin lote ni patio registrados'}
                  {' · '}{pendientes.length} por decidir
                  {porEvaluar > 0 && ` · ${porEvaluar} sin precio de mercado`}
                </p>
                {subasta.enlace_fotos && (
                  <span style={{ display: 'inline-flex', gap: 12, flexWrap: 'wrap' }}>
                    <button className="btn-link" onClick={() => setExplorando(true)}>Ver unidades en Dropbox</button>
                    <a className="btn-link" href={subasta.enlace_fotos} target="_blank" rel="noreferrer">Abrir en Dropbox ↗</a>
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn-link" onClick={() => setSubastaModal(subasta)}>Editar subasta</button>
                <button className="btn-link peligro" onClick={() => eliminarSubasta(subasta)}>Eliminar</button>
                <button className="btn btn-primario" onClick={() => setEvaluacionModal('nueva')}>+ Agregar vehículo</button>
              </div>
            </div>
          </div>

          {Object.keys(porMarca).sort().map((marca) => (
            <section key={marca} style={{ marginBottom: 24 }}>
              <h2 style={{ marginBottom: 10 }}>{marca}</h2>
              <div className="tabla-wrap">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Torre</th>
                      <th>Vehículo</th>
                      <th>Km llegada</th>
                      <th className="num">Precio mercado</th>
                      <th className="num">Reparación</th>
                      <th className="num">Puja máxima</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {porMarca[marca].map((e) => (
                      <tr key={e.id}>
                        <td className="nowrap">
                          {e.torre ?? '—'}
                          {e.stock && <span className="unidad-folio">Stock {e.stock}</span>}
                        </td>
                        <td>
                          <span className="unidad-nombre">{e.modelo} {e.anio}</span>
                          <span className="unidad-folio">{[e.version, e.color, e.transmision && TRANSMISION_LABEL[e.transmision]].filter(Boolean).join(' · ')}</span>
                        </td>
                        <td>
                          {km(e.kilometraje_llegada)}
                          {e.valor_factura != null && <span className="unidad-folio">Factura {mxn(e.valor_factura)}</span>}
                        </td>
                        {e.precio_venta_esperado ? (
                          <>
                            <td className="num">{mxn(e.precio_venta_esperado)}</td>
                            <td className="num">{mxn(e.costo_reparacion_estimado)}</td>
                            <td className="num">
                              <strong style={{ color: (e.techo_puja ?? 0) < 0 ? 'var(--danger)' : 'var(--primary)' }}>{mxn(e.techo_puja)}</strong>
                              <span className="unidad-folio">ROI {porcentaje(e.roi_proyectado)}</span>
                            </td>
                          </>
                        ) : (
                          <td colSpan={3}>
                            <button className="btn-link" onClick={() => setEvaluacionModal(e)}>Por evaluar: capturar precio de mercado y reparación</button>
                          </td>
                        )}
                        <td className="acciones-celda">
                          {subasta.enlace_fotos && e.torre && (
                            <><button className="btn btn-secundario btn-chico" onClick={() => setViendoFotos(e)}>Fotos</button>{' '}</>
                          )}
                          <button className="btn btn-primario btn-chico" onClick={() => setAdquiriendo(e)}>Adquirir</button>{' '}
                          <select className="select select-chico" value="" onChange={(ev) => {
                            const accion = ev.target.value
                            if (accion === 'editar') setEvaluacionModal(e)
                            else if (accion === 'eliminar') eliminarEvaluacion(e)
                            else if (accion) cambiarResultado(e, accion as EvaluacionPuja['resultado'])
                          }}>
                            <option value="">Más…</option>
                            <option value="editar">Editar</option>
                            <option value="perdida">Marcar perdida</option>
                            <option value="descartada">Descartar</option>
                            <option value="eliminar">Eliminar</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
          {pendientes.length === 0 && (
            <p className="texto-suave">
              No hay vehículos pendientes en esta subasta. Usa "Cargar listado (PDF)", "+ Agregar vehículo"
              {subasta.enlace_fotos ? ' o "Ver unidades en Dropbox"' : ''} para agregar.
            </p>
          )}

          {decididas.length > 0 && (
            <details className="plegable" style={{ marginTop: 20 }}>
              <summary>Ya decididos ({decididas.length})</summary>
              <div className="tabla-wrap" style={{ marginTop: 8 }}>
                <table className="tabla">
                  <tbody>
                    {decididas.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <span className="unidad-nombre">{e.marca} {e.modelo} {e.anio}</span>
                          <span className="unidad-folio">Torre {e.torre ?? '—'}</span>
                        </td>
                        <td><EtiquetaBadge etiqueta={etiqueta(RESULTADO_EVALUACION, e.resultado)} /></td>
                        <td className="acciones-celda">
                          {e.resultado === 'ganada' && e.vehiculo_id
                            ? <button className="btn-link" onClick={() => navigate(`/vehiculo/${e.vehiculo_id}`)}>Ver unidad</button>
                            : <button className="btn-link" onClick={() => cambiarResultado(e, 'pendiente')}>Regresar a pendiente</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}

      {subastaModal && (
        <SubastaModal
          subasta={subastaModal === 'nueva' ? null : subastaModal}
          onClose={() => setSubastaModal(null)}
          onGuardado={(id) => { setSubastaModal(null); recargar(id) }}
        />
      )}
      {evaluacionModal && subastaId && (
        <EvaluacionModal
          subastaId={subastaId}
          evaluacion={evaluacionModal === 'nueva' ? null : evaluacionModal}
          inicial={evaluacionModal === 'nueva' ? nuevaDesdeDropbox : null}
          roiSegmento={roiSegmento}
          onClose={() => { setEvaluacionModal(null); setNuevaDesdeDropbox(null) }}
          onGuardado={() => { setEvaluacionModal(null); setNuevaDesdeDropbox(null); recargar(subastaId) }}
        />
      )}
      {cargandoListado && (
        <CargaListadoModal
          subastas={subastas}
          onClose={() => setCargandoListado(false)}
          onGuardado={(id) => { setCargandoListado(false); setCargando(true); recargar(id) }}
        />
      )}
      {explorando && subasta?.enlace_fotos && (
        <ExploradorDropbox
          enlace={subasta.enlace_fotos}
          evaluaciones={evaluaciones}
          onEvaluar={(u) => { setExplorando(false); setNuevaDesdeDropbox({ torre: u.torre, stock: u.stock }); setEvaluacionModal('nueva') }}
          onClose={() => setExplorando(false)}
        />
      )}
      {viendoFotos && subasta?.enlace_fotos && viendoFotos.torre && (
        <FotosDropboxModal
          enlace={subasta.enlace_fotos}
          torre={viendoFotos.torre}
          stock={viendoFotos.stock}
          titulo={`${viendoFotos.marca} ${viendoFotos.modelo} ${viendoFotos.anio}`}
          onClose={() => setViendoFotos(null)}
        />
      )}
      {adquiriendo && (
        <AdquirirModal
          enlaceFotos={subasta?.enlace_fotos ?? null}
          evaluacion={adquiriendo}
          estados={estados}
          ubicaciones={ubicaciones}
          onClose={() => setAdquiriendo(null)}
          onAdquirido={(vehiculoId) => navigate(`/vehiculo/${vehiculoId}`)}
        />
      )}
    </div>
  )
}

function SubastaModal({ subasta, onClose, onGuardado }: { subasta: Subasta | null; onClose: () => void; onGuardado: (id: number) => void }) {
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:subasta:${subasta?.id ?? 'nueva'}`, {
    plataforma: subasta?.plataforma ?? 'Prosubastas',
    fecha: subasta?.fecha ?? hoyISO(),
    lote: subasta?.lote ?? '',
    patioOrigen: subasta?.patio_origen ?? '',
    enlaceFotos: subasta?.enlace_fotos ?? '',
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    const datos = { plataforma: form.plataforma.trim(), fecha: form.fecha, lote: form.lote.trim() || null, patio_origen: form.patioOrigen.trim() || null, enlace_fotos: form.enlaceFotos.trim() || null }
    const { data, error } = subasta
      ? await supabase.from('subasta').update(datos).eq('id', subasta.id).select().single()
      : await supabase.from('subasta').insert(datos).select().single()
    setGuardando(false)
    if (error || !data) { setError(error?.message ?? 'No se pudo guardar.'); return }
    limpiarBorrador()
    onGuardado(data.id)
  }

  return (
    <Modal titulo={subasta ? 'Editar subasta' : 'Nueva subasta'} onClose={onClose}>
      <form onSubmit={onSubmit} className="form">
        <div className="form-grid">
          <Campo label="Plataforma"><input className="input" required value={form.plataforma} onChange={(e) => set('plataforma', e.target.value)} /></Campo>
          <Campo label="Fecha"><input className="input" required type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} /></Campo>
        </div>
        <div className="form-grid">
          <Campo label="Lote (opcional)"><input className="input" value={form.lote} onChange={(e) => set('lote', e.target.value)} /></Campo>
          <Campo label="Patio de origen (opcional)"><input className="input" value={form.patioOrigen} onChange={(e) => set('patioOrigen', e.target.value)} /></Campo>
        </div>
        <Campo label="Enlace de Dropbox con las fotos (opcional)"><input className="input" value={form.enlaceFotos} onChange={(e) => set('enlaceFotos', e.target.value)} /></Campo>
        {error && <Alerta>{error}</Alerta>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}

function EvaluacionModal({ subastaId, evaluacion, inicial, roiSegmento, onClose, onGuardado }: {
  subastaId: number
  evaluacion: EvaluacionPuja | null
  /** Torre y stock ya conocidos (al evaluar desde las carpetas de Dropbox). */
  inicial?: { torre: string; stock: string | null } | null
  roiSegmento: RoiSegmento[]
  onClose: () => void
  onGuardado: () => void
}) {
  const ev = evaluacion
  const { comision_subasta: COMISION_SUBASTA, margen_deseado: margenDefault } = useParametros()
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:evaluacion:${subastaId}:${ev?.id ?? `nueva${inicial?.stock ?? inicial?.torre ?? ''}`}`, {
    marca: ev?.marca ?? '', modelo: ev?.modelo ?? '', anio: String(ev?.anio ?? new Date().getFullYear()),
    version: ev?.version ?? '', torre: ev?.torre ?? inicial?.torre ?? '', stock: ev?.stock ?? inicial?.stock ?? '',
    kilometrajeLlegada: ev?.kilometraje_llegada != null ? String(ev.kilometraje_llegada) : '',
    danos: ev?.danos_observados ?? '',
    costoReparacion: ev ? String(ev.costo_reparacion_estimado) : '',
    precioMercado: ev ? String(ev.precio_venta_esperado) : '',
    margenDeseado: ev?.margen_deseado != null ? String(Math.round(ev.margen_deseado * 1000) / 10) : String(margenDefault),
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const costoRep = Number(form.costoReparacion) || 0
  const precioMkt = Number(form.precioMercado) || 0
  const margen = (Number(form.margenDeseado) || 0) / 100
  const utilidadObjetivo = margen * precioMkt
  const techoPuja = precioMkt - costoRep - COMISION_SUBASTA - utilidadObjetivo
  const costoTotalProyectado = techoPuja + costoRep + COMISION_SUBASTA
  const roiProyectado = costoTotalProyectado > 0 ? utilidadObjetivo / costoTotalProyectado : 0
  const banda = costoTotalProyectado < 110000 ? 'baja' : costoTotalProyectado < 180000 ? 'media' : 'alta'
  const historicoBanda = roiSegmento.filter((r) => r.banda === banda)
  const roiHistorico = historicoBanda.length > 0 ? historicoBanda.reduce((acc, r) => acc + r.roi_promedio, 0) / historicoBanda.length : null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    const datos = {
      subasta_id: subastaId,
      marca: form.marca.trim(), modelo: form.modelo.trim(), anio: Number(form.anio), version: form.version.trim() || null,
      torre: form.torre.trim() || null,
      stock: form.stock.trim() || null,
      kilometraje_llegada: numeroONull(form.kilometrajeLlegada),
      danos_observados: form.danos.trim() || null,
      costo_reparacion_estimado: costoRep,
      precio_venta_esperado: precioMkt,
      margen_deseado: margen,
      techo_puja: techoPuja,
      roi_proyectado: roiProyectado,
      roi_historico_segmento: roiHistorico,
    }
    const { error } = ev
      ? await supabase.from('evaluacion_puja').update(datos).eq('id', ev.id)
      : await supabase.from('evaluacion_puja').insert(datos)
    setGuardando(false)
    if (error) { setError(error.message); return }
    limpiarBorrador()
    onGuardado()
  }

  return (
    <Modal titulo={ev ? 'Editar vehículo evaluado' : 'Vehículo a evaluar'} onClose={onClose} ancho={600}>
      <form onSubmit={onSubmit} className="form">
        <div className="form-grid">
          <Campo label="Marca"><input className="input" required value={form.marca} onChange={(e) => set('marca', e.target.value)} autoFocus /></Campo>
          <Campo label="Modelo"><input className="input" required value={form.modelo} onChange={(e) => set('modelo', e.target.value)} /></Campo>
          <Campo label="Año"><input className="input" required type="number" min={1980} max={2100} value={form.anio} onChange={(e) => set('anio', e.target.value)} /></Campo>
        </div>
        <div className="form-grid">
          <Campo label="Versión"><input className="input" value={form.version} onChange={(e) => set('version', e.target.value)} /></Campo>
          <Campo label="Torre"><input className="input" value={form.torre} onChange={(e) => set('torre', e.target.value)} /></Campo>
          <Campo label="Stock"><input className="input" value={form.stock} onChange={(e) => set('stock', e.target.value)} /></Campo>
          <Campo label="Km de llegada"><input className="input" type="number" min={0} value={form.kilometrajeLlegada} onChange={(e) => set('kilometrajeLlegada', e.target.value)} /></Campo>
        </div>
        {ev?.stock && (
          <details className="plegable">
            <summary>Datos del listado de la subasta</summary>
            <div className="datos" style={{ marginTop: 8 }}>
              <div><div className="dato-label">Stock</div><div>{ev.stock}</div></div>
              {ev.vin && <div><div className="dato-label">Serie</div><div>{ev.vin}</div></div>}
              {ev.color && <div><div className="dato-label">Color</div><div>{ev.color}</div></div>}
              {ev.puertas && <div><div className="dato-label">Puertas</div><div>{ev.puertas}</div></div>}
              {ev.equipamiento && <div><div className="dato-label">Equipamiento</div><div>{ev.equipamiento}</div></div>}
              {ev.valor_factura != null && <div><div className="dato-label">Factura de origen</div><div>{mxn(ev.valor_factura)}{ev.fecha_factura ? ` · ${fecha(ev.fecha_factura)}` : ''}</div></div>}
              {ev.vendedor && <div><div className="dato-label">Vendedor</div><div>{ev.vendedor}</div></div>}
            </div>
            {ev.info_documentos && <p className="texto-suave" style={{ marginBottom: 0 }}>{ev.info_documentos}</p>}
          </details>
        )}
        <Campo label="Daños observados"><input className="input" value={form.danos} onChange={(e) => set('danos', e.target.value)} /></Campo>
        <div className="form-grid">
          <Campo label="Precio de mercado"><input className="input" required type="number" step="0.01" min={0} value={form.precioMercado} onChange={(e) => set('precioMercado', e.target.value)} /></Campo>
          <Campo label="Presupuesto de reparación"><input className="input" required type="number" step="0.01" min={0} value={form.costoReparacion} onChange={(e) => set('costoReparacion', e.target.value)} /></Campo>
          <Campo label="Margen deseado (%)"><input className="input" required type="number" step="0.1" value={form.margenDeseado} onChange={(e) => set('margenDeseado', e.target.value)} /></Campo>
        </div>

        <div className="resumen">
          <div>Puja máxima recomendada: <strong style={{ color: techoPuja < 0 ? 'var(--danger)' : 'var(--primary)' }}>{mxn(techoPuja)}</strong></div>
          <div className="texto-suave">
            = precio de mercado − reparación − comisión de subasta ({mxn(COMISION_SUBASTA)}) − utilidad objetivo ({mxn(utilidadObjetivo)})
          </div>
          <div>ROI proyectado: <strong>{porcentaje(roiProyectado)}</strong>{roiHistorico !== null && <span className="texto-suave"> · histórico de unidades parecidas: {porcentaje(roiHistorico)}</span>}</div>
          {techoPuja < 0 && <div style={{ color: 'var(--danger)' }}>Con estos números no hay margen para pujar.</div>}
        </div>

        {error && <Alerta>{error}</Alerta>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}

function AdquirirModal({ enlaceFotos, evaluacion, estados, ubicaciones, onClose, onAdquirido }: {
  enlaceFotos: string | null
  evaluacion: EvaluacionPuja
  estados: { id: number; clave: string }[]
  ubicaciones: { id: number; clave: string }[]
  onClose: () => void
  onAdquirido: (vehiculoId: number) => void
}) {
  const { comision_subasta: COMISION_SUBASTA } = useParametros()
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:adquirir:${evaluacion.id}`, {
    precio: '',
    comision: String(COMISION_SUBASTA), fechaCompra: hoyISO(),
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const puedeCopiar = Boolean(enlaceFotos && evaluacion.torre && dropboxConectado())
  const [copiar, setCopiar] = useState(puedeCopiar)
  const [avance, setAvance] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)

    const { data: vehiculo, error: errVehiculo } = await supabase.from('vehiculo').insert({
      id_interno: '',
      marca: evaluacion.marca, modelo: evaluacion.modelo, anio: evaluacion.anio, version: evaluacion.version,
      kilometraje: evaluacion.kilometraje_llegada,
      vin: evaluacion.vin, color: evaluacion.color, transmision: evaluacion.transmision,
      torre: evaluacion.torre, stock_subasta: evaluacion.stock, subasta_id: evaluacion.subasta_id,
      estado_proceso_id: estados.find((x) => x.clave === 'comprado')?.id,
      ubicacion_id: ubicaciones.find((u) => u.clave === 'traslado')?.id,
      fecha_compra: form.fechaCompra, precio_autorizado: evaluacion.precio_venta_esperado || null,
    }).select('id').single()

    if (errVehiculo || !vehiculo) {
      setGuardando(false)
      setError(errVehiculo?.message ?? 'No se pudo crear la unidad.')
      return
    }

    const { error: errCompra } = await supabase.from('compra').insert({
      vehiculo_id: vehiculo.id, precio: Number(form.precio), comision: Number(form.comision) || 0,
    })
    if (errCompra) {
      // Sin compra la unidad quedaría sin costo y el folio bloqueado para reintentar.
      await supabase.from('vehiculo').delete().eq('id', vehiculo.id)
      setGuardando(false)
      setError(`No se pudo registrar la compra: ${errCompra.message}`)
      return
    }

    await supabase.from('evaluacion_puja').update({ resultado: 'ganada', vehiculo_id: vehiculo.id }).eq('id', evaluacion.id)

    // La unidad ya quedó creada: si falla la copia de Dropbox no se deshace,
    // solo se avisa (las fotos se pueden subir después desde el Expediente).
    if (copiar && enlaceFotos && evaluacion.torre) {
      try {
        const resumen = await copiarDeDropbox({ enlace: enlaceFotos, torre: evaluacion.torre, stock: evaluacion.stock, vehiculoId: vehiculo.id, onAvance: setAvance })
        window.alert(resumen)
      } catch (err) {
        window.alert(`La unidad se adquirió, pero falló la copia desde Dropbox: ${(err as Error).message}`)
      }
    }

    setGuardando(false)
    limpiarBorrador()
    onAdquirido(vehiculo.id)
  }

  return (
    <Modal
      titulo={`Adquirir ${evaluacion.marca} ${evaluacion.modelo} ${evaluacion.anio}`}
      subtitulo={`Crea la unidad en Inventario con su compra. Puja máxima calculada: ${mxn(evaluacion.techo_puja)}.`}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="form">
        <div className="form-grid">
          <Campo label="Precio pagado"><input className="input" required type="number" step="0.01" min={0} value={form.precio} onChange={(e) => set('precio', e.target.value)} /></Campo>
          <Campo label="Comisión de subasta"><input className="input" required type="number" step="0.01" min={0} value={form.comision} onChange={(e) => set('comision', e.target.value)} /></Campo>
        </div>
        <Campo label="Fecha de compra"><input className="input" required type="date" value={form.fechaCompra} onChange={(e) => set('fechaCompra', e.target.value)} /></Campo>
        {puedeCopiar && (
          <label className="check">
            <input type="checkbox" checked={copiar} onChange={(e) => setCopiar(e.target.checked)} />
            Copiar de Dropbox la hoja de inspección, el REPUVE y 8 fotos
          </label>
        )}
        {avance && guardando && <p className="texto-suave" style={{ margin: 0 }}>{avance}</p>}
        {error && <Alerta>{error}</Alerta>}
        <FormBotones onClose={onClose} guardando={guardando} textoGuardar="Adquirir" />
      </form>
    </Modal>
  )
}
