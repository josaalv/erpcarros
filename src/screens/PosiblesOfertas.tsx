import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCatalogos } from '../lib/catalogos'
import { useBorrador } from '../lib/useBorrador'
import { useParametros } from '../lib/parametros'
import { mxn, porcentaje, fecha, km, hoyISO, numeroONull, etiqueta, RESULTADO_EVALUACION } from '../lib/helpers'
import { Modal, FormBotones, PageHeader, Campo, Alerta, Cargando, EtiquetaBadge } from '../components/Ui'
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
        acciones={<button className="btn btn-secundario" onClick={() => setSubastaModal('nueva')}>+ Nueva subasta</button>}
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
                </p>
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
                      <th className="num">ROI</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {porMarca[marca].map((e) => (
                      <tr key={e.id}>
                        <td>{e.torre ?? '—'}</td>
                        <td>
                          <span className="unidad-nombre">{e.modelo} {e.anio}</span>
                          {e.version && <span className="unidad-folio">{e.version}</span>}
                        </td>
                        <td>{km(e.kilometraje_llegada)}</td>
                        <td className="num">{mxn(e.precio_venta_esperado)}</td>
                        <td className="num">{mxn(e.costo_reparacion_estimado)}</td>
                        <td className="num" style={{ fontWeight: 700, color: (e.techo_puja ?? 0) < 0 ? 'var(--danger)' : 'var(--primary)' }}>{mxn(e.techo_puja)}</td>
                        <td className="num">{porcentaje(e.roi_proyectado)}</td>
                        <td className="acciones-celda">
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
            <p className="texto-suave">No hay vehículos pendientes en esta subasta. Usa "+ Agregar vehículo" para evaluar uno.</p>
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
          roiSegmento={roiSegmento}
          onClose={() => setEvaluacionModal(null)}
          onGuardado={() => { setEvaluacionModal(null); recargar(subastaId) }}
        />
      )}
      {adquiriendo && (
        <AdquirirModal
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
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    const datos = { plataforma: form.plataforma.trim(), fecha: form.fecha, lote: form.lote.trim() || null, patio_origen: form.patioOrigen.trim() || null }
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
        {error && <Alerta>{error}</Alerta>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}

function EvaluacionModal({ subastaId, evaluacion, roiSegmento, onClose, onGuardado }: {
  subastaId: number
  evaluacion: EvaluacionPuja | null
  roiSegmento: RoiSegmento[]
  onClose: () => void
  onGuardado: () => void
}) {
  const ev = evaluacion
  const { comision_subasta: COMISION_SUBASTA, margen_deseado: margenDefault } = useParametros()
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:evaluacion:${subastaId}:${ev?.id ?? 'nueva'}`, {
    marca: ev?.marca ?? '', modelo: ev?.modelo ?? '', anio: String(ev?.anio ?? new Date().getFullYear()),
    version: ev?.version ?? '', torre: ev?.torre ?? '',
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
          <Campo label="Km de llegada"><input className="input" type="number" min={0} value={form.kilometrajeLlegada} onChange={(e) => set('kilometrajeLlegada', e.target.value)} /></Campo>
        </div>
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

function AdquirirModal({ evaluacion, estados, ubicaciones, onClose, onAdquirido }: {
  evaluacion: EvaluacionPuja
  estados: { id: number; clave: string }[]
  ubicaciones: { id: number; clave: string }[]
  onClose: () => void
  onAdquirido: (vehiculoId: number) => void
}) {
  const { comision_subasta: COMISION_SUBASTA } = useParametros()
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:adquirir:${evaluacion.id}`, {
    idInterno: '', precio: '',
    comision: String(COMISION_SUBASTA), fechaCompra: hoyISO(),
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)

    const { data: vehiculo, error: errVehiculo } = await supabase.from('vehiculo').insert({
      id_interno: form.idInterno.trim(),
      marca: evaluacion.marca, modelo: evaluacion.modelo, anio: evaluacion.anio, version: evaluacion.version,
      kilometraje: evaluacion.kilometraje_llegada,
      estado_proceso_id: estados.find((x) => x.clave === 'comprado')?.id,
      ubicacion_id: ubicaciones.find((u) => u.clave === 'traslado')?.id,
      fecha_compra: form.fechaCompra, precio_autorizado: evaluacion.precio_venta_esperado,
    }).select().single()

    if (errVehiculo || !vehiculo) {
      setGuardando(false)
      setError(errVehiculo?.message.includes('duplicate') ? `Ya existe una unidad con el folio ${form.idInterno}.` : (errVehiculo?.message ?? 'No se pudo crear la unidad.'))
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
        <Campo label="Folio interno" ayuda="Ej. V-1020"><input className="input" required value={form.idInterno} onChange={(e) => set('idInterno', e.target.value)} autoFocus /></Campo>
        <div className="form-grid">
          <Campo label="Precio pagado"><input className="input" required type="number" step="0.01" min={0} value={form.precio} onChange={(e) => set('precio', e.target.value)} /></Campo>
          <Campo label="Comisión de subasta"><input className="input" required type="number" step="0.01" min={0} value={form.comision} onChange={(e) => set('comision', e.target.value)} /></Campo>
        </div>
        <Campo label="Fecha de compra"><input className="input" required type="date" value={form.fechaCompra} onChange={(e) => set('fechaCompra', e.target.value)} /></Campo>
        {error && <Alerta>{error}</Alerta>}
        <FormBotones onClose={onClose} guardando={guardando} textoGuardar="Adquirir" />
      </form>
    </Modal>
  )
}
