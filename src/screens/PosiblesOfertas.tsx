import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCatalogos } from '../lib/catalogos'
import { useBorrador } from '../lib/useBorrador'
import { mxn, porcentaje } from '../lib/helpers'
import { inputStyle, th, td, btnPrimario, btnSecundario, selectStyle } from '../lib/ui'
import { Modal, FormBotones } from '../components/Ui'
import type { Subasta, EvaluacionPuja, RoiSegmento } from '../types'

// Comisión de subasta estándar (mismo valor que compra.comision por
// default) — se usa como costo fijo proyectado antes de que exista la
// compra real.
const COMISION_SUBASTA = 5000

/**
 * Etapa 1 del ciclo: unidades que TODAVÍA no son nuestras. Se registran
 * subastas con fecha, y dentro de cada una los vehículos candidatos,
 * agrupados por marca y torre. "Adquirir" es la única puerta hacia
 * Inventario — crea el vehículo real y la evaluación deja de contar como
 * posible oferta (resultado deja de ser 'pendiente').
 */
export default function PosiblesOfertas() {
  const navigate = useNavigate()
  const { estados, ubicaciones, cargando: cargandoCatalogos } = useCatalogos()
  const [subastas, setSubastas] = useState<Subasta[]>([])
  const [subastaId, setSubastaId] = useState<number | null>(null)
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionPuja[]>([])
  const [roiSegmento, setRoiSegmento] = useState<RoiSegmento[]>([])
  const [cargando, setCargando] = useState(true)
  const [abrirSubasta, setAbrirSubasta] = useState(false)
  const [abrirEvaluacion, setAbrirEvaluacion] = useState(false)
  const [adquiriendo, setAdquiriendo] = useState<EvaluacionPuja | null>(null)

  async function recargar(subastaSeleccionada?: number | null) {
    if (!supabase) return
    const [s, r] = await Promise.all([
      supabase.from('subasta').select('*').order('fecha', { ascending: false }),
      supabase.from('v_roi_segmento').select('*'),
    ])
    const listaSubastas = (s.data ?? []) as Subasta[]
    setSubastas(listaSubastas)
    setRoiSegmento((r.data ?? []) as RoiSegmento[])

    const idActivo = subastaSeleccionada !== undefined ? subastaSeleccionada : (subastaId ?? listaSubastas[0]?.id ?? null)
    setSubastaId(idActivo)

    if (idActivo) {
      const { data } = await supabase.from('evaluacion_puja').select('*').eq('subasta_id', idActivo).order('marca')
      setEvaluaciones((data ?? []) as EvaluacionPuja[])
    } else {
      setEvaluaciones([])
    }
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  async function seleccionarSubasta(id: number) {
    setCargando(true)
    await recargar(id)
  }

  async function cambiarResultado(id: number, resultado: EvaluacionPuja['resultado']) {
    if (!supabase) return
    await supabase.from('evaluacion_puja').update({ resultado }).eq('id', id)
    recargar(subastaId)
  }

  const pendientes = evaluaciones.filter((e) => e.resultado === 'pendiente')
  const decididas = evaluaciones.filter((e) => e.resultado !== 'pendiente')

  // Agrupar pendientes por marca, y dentro de cada marca ordenar por torre.
  const porMarca = pendientes.reduce<Record<string, EvaluacionPuja[]>>((acc, e) => {
    (acc[e.marca] ??= []).push(e)
    return acc
  }, {})
  Object.values(porMarca).forEach((lista) => lista.sort((a, b) => (a.torre ?? '').localeCompare(b.torre ?? '')))

  if (cargando || cargandoCatalogos) return <p>Cargando…</p>

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h1 style={{ font: '400 26px Georgia, serif', margin: 0 }}>Posibles ofertas</h1>
        <button onClick={() => setAbrirSubasta(true)} style={btnSecundario}>+ Nueva subasta</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {subastas.map((s) => (
          <button
            key={s.id}
            onClick={() => seleccionarSubasta(s.id)}
            style={{
              padding: '7px 12px', fontSize: 12, border: '1px solid #e4e0d8', cursor: 'pointer',
              background: subastaId === s.id ? '#26302f' : '#fff',
              color: subastaId === s.id ? '#f3f1ec' : '#1c1b19',
            }}
          >
            {s.plataforma} · {s.fecha}
          </button>
        ))}
        {subastas.length === 0 && <p style={{ fontSize: 12.5, color: '#8b8578' }}>Sin subastas registradas todavía.</p>}
      </div>

      {subastaId && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button onClick={() => setAbrirEvaluacion(true)} style={btnPrimario}>+ Agregar vehículo a evaluar</button>
          </div>

          {Object.keys(porMarca).sort().map((marca) => (
            <div key={marca} style={{ marginBottom: 22 }}>
              <h2 style={{ font: '500 14px "IBM Plex Sans"', margin: '0 0 6px' }}>{marca}</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff' }}>
                <thead>
                  <tr style={{ background: '#faf9f6' }}>
                    {['Torre', 'Unidad', 'Km llegada', 'Precio mercado', 'Presupuesto rep.', 'Techo de puja', 'ROI proy.', ''].map((h) => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {porMarca[marca].map((e) => (
                    <tr key={e.id} style={{ borderTop: '1px solid #f0ede6' }}>
                      <td style={td}>{e.torre ?? '—'}</td>
                      <td style={td}>{e.modelo} {e.anio} {e.version && <span style={{ color: '#8b8578' }}>· {e.version}</span>}</td>
                      <td style={td}>{e.kilometraje_llegada?.toLocaleString('es-MX') ?? '—'} km</td>
                      <td style={{ ...td, textAlign: 'right' }}>{mxn(e.precio_venta_esperado)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{mxn(e.costo_reparacion_estimado)}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 500 }}>{mxn(e.techo_puja)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{porcentaje(e.roi_proyectado)}</td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => setAdquiriendo(e)} style={{ ...btnPrimario, marginRight: 8, padding: '5px 10px' }}>Adquirir</button>
                        <select
                          value={e.resultado}
                          onChange={(ev) => cambiarResultado(e.id, ev.target.value as EvaluacionPuja['resultado'])}
                          style={{ ...selectStyle, fontSize: 11 }}
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="perdida">Perdida</option>
                          <option value="descartada">Descartada</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {pendientes.length === 0 && (
            <p style={{ fontSize: 12.5, color: '#8b8578', padding: '10px 0' }}>Sin vehículos pendientes de decidir en esta subasta.</p>
          )}

          {decididas.length > 0 && (
            <details style={{ marginTop: 20 }}>
              <summary style={{ fontSize: 12, color: '#8b8578', cursor: 'pointer' }}>Ya decididas ({decididas.length})</summary>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff', marginTop: 8 }}>
                <tbody>
                  {decididas.map((e) => (
                    <tr key={e.id} style={{ borderTop: '1px solid #f0ede6' }}>
                      <td style={td}>{e.marca} {e.modelo} {e.anio} <span style={{ color: '#8b8578' }}>· torre {e.torre ?? '—'}</span></td>
                      <td style={td}>{e.resultado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </>
      )}

      {abrirSubasta && (
        <SubastaModal onClose={() => setAbrirSubasta(false)} onGuardado={(id) => { setAbrirSubasta(false); recargar(id) }} />
      )}
      {abrirEvaluacion && subastaId && (
        <EvaluacionModal
          subastaId={subastaId}
          roiSegmento={roiSegmento}
          onClose={() => setAbrirEvaluacion(false)}
          onGuardado={() => { setAbrirEvaluacion(false); recargar(subastaId) }}
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

function SubastaModal({ onClose, onGuardado }: { onClose: () => void; onGuardado: (id: number) => void }) {
  const [form, setForm, limpiarBorrador] = useBorrador('borrador:subasta-nueva', {
    plataforma: 'Prosubastas', fecha: new Date().toISOString().slice(0, 10), lote: '', patioOrigen: '',
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    const { data, error } = await supabase.from('subasta').insert({
      plataforma: form.plataforma, fecha: form.fecha, lote: form.lote || null, patio_origen: form.patioOrigen || null,
    }).select().single()
    setGuardando(false)
    if (error || !data) { setError(error?.message ?? 'No se pudo guardar.'); return }
    limpiarBorrador()
    onGuardado(data.id)
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0, font: '500 16px Georgia, serif' }}>Nueva subasta</h3>
        <input required placeholder="Plataforma" value={form.plataforma} onChange={(e) => set('plataforma', e.target.value)} style={inputStyle} />
        <input required type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} style={inputStyle} />
        <input placeholder="Lote (opcional)" value={form.lote} onChange={(e) => set('lote', e.target.value)} style={inputStyle} />
        <input placeholder="Patio de origen (opcional)" value={form.patioOrigen} onChange={(e) => set('patioOrigen', e.target.value)} style={inputStyle} />
        {error && <div style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)' }}>{error}</div>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}

function EvaluacionModal({ subastaId, roiSegmento, onClose, onGuardado }: {
  subastaId: number
  roiSegmento: RoiSegmento[]
  onClose: () => void
  onGuardado: () => void
}) {
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:evaluacion:${subastaId}`, {
    marca: '', modelo: '', anio: String(new Date().getFullYear()), version: '', torre: '',
    kilometrajeLlegada: '', danos: '', costoReparacion: '', precioMercado: '', margenDeseado: '20',
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
    const { error } = await supabase.from('evaluacion_puja').insert({
      subasta_id: subastaId,
      marca: form.marca, modelo: form.modelo, anio: Number(form.anio), version: form.version || null,
      torre: form.torre || null,
      kilometraje_llegada: form.kilometrajeLlegada ? Number(form.kilometrajeLlegada) : null,
      danos_observados: form.danos || null,
      costo_reparacion_estimado: costoRep,
      precio_venta_esperado: precioMkt,
      margen_deseado: margen,
      techo_puja: techoPuja,
      roi_proyectado: roiProyectado,
      roi_historico_segmento: roiHistorico,
    })
    setGuardando(false)
    if (error) { setError(error.message); return }
    limpiarBorrador()
    onGuardado()
  }

  return (
    <Modal onClose={onClose} ancho={420}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <h3 style={{ margin: 0, font: '500 16px Georgia, serif' }}>Vehículo a evaluar</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: 8 }}>
          <input required placeholder="Marca" value={form.marca} onChange={(e) => set('marca', e.target.value)} style={inputStyle} />
          <input required placeholder="Modelo" value={form.modelo} onChange={(e) => set('modelo', e.target.value)} style={inputStyle} />
          <input required type="number" placeholder="Año" value={form.anio} onChange={(e) => set('anio', e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input placeholder="Versión" value={form.version} onChange={(e) => set('version', e.target.value)} style={inputStyle} />
          <input placeholder="Torre" value={form.torre} onChange={(e) => set('torre', e.target.value)} style={inputStyle} />
        </div>
        <input type="number" placeholder="Kilometraje de llegada" value={form.kilometrajeLlegada} onChange={(e) => set('kilometrajeLlegada', e.target.value)} style={inputStyle} />
        <input placeholder="Daños observados" value={form.danos} onChange={(e) => set('danos', e.target.value)} style={inputStyle} />
        <input required type="number" step="0.01" placeholder="Precio actual de mercado" value={form.precioMercado} onChange={(e) => set('precioMercado', e.target.value)} style={inputStyle} />
        <input required type="number" step="0.01" placeholder="Presupuesto de reparación" value={form.costoReparacion} onChange={(e) => set('costoReparacion', e.target.value)} style={inputStyle} />
        <label style={{ fontSize: 11.5, color: '#8b8578' }}>
          Margen deseado (%)
          <input required type="number" step="0.1" value={form.margenDeseado} onChange={(e) => set('margenDeseado', e.target.value)} style={{ ...inputStyle, width: '100%', marginTop: 4 }} />
        </label>

        <div style={{ background: '#faf9f6', border: '1px solid #e4e0d8', padding: 10, fontSize: 12 }}>
          <div>Techo de puja: <strong>{mxn(techoPuja)}</strong></div>
          <div>ROI proyectado: {porcentaje(roiProyectado)} {roiHistorico !== null && <span style={{ color: '#8b8578' }}>(histórico banda {banda}: {porcentaje(roiHistorico)})</span>}</div>
          {techoPuja < 0 && <div style={{ color: 'oklch(0.48 0.13 32)', marginTop: 4 }}>Techo negativo: sin margen para pujar con estos supuestos.</div>}
        </div>

        {error && <div style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)' }}>{error}</div>}
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
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:adquirir:${evaluacion.id}`, {
    idInterno: '', precio: '', comision: '5000', fechaCompra: new Date().toISOString().slice(0, 10),
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)

    const estadoInicial = estados.find((es) => es.clave === 'comprado')
    const ubicacionInicial = ubicaciones.find((u) => u.clave === 'traslado')

    const { data: vehiculo, error: errVehiculo } = await supabase.from('vehiculo').insert({
      id_interno: form.idInterno,
      marca: evaluacion.marca, modelo: evaluacion.modelo, anio: evaluacion.anio, version: evaluacion.version,
      kilometraje: evaluacion.kilometraje_llegada,
      estado_proceso_id: estadoInicial?.id, ubicacion_id: ubicacionInicial?.id,
      fecha_compra: form.fechaCompra, precio_autorizado: evaluacion.precio_venta_esperado,
    }).select().single()

    if (errVehiculo || !vehiculo) {
      setGuardando(false)
      setError(errVehiculo?.message ?? 'No se pudo crear la unidad.')
      return
    }

    const { error: errCompra } = await supabase.from('compra').insert({
      vehiculo_id: vehiculo.id, precio: Number(form.precio), comision: Number(form.comision),
    })
    if (errCompra) {
      setGuardando(false)
      setError(errCompra.message)
      return
    }

    await supabase.from('evaluacion_puja').update({ resultado: 'ganada', vehiculo_id: vehiculo.id }).eq('id', evaluacion.id)

    setGuardando(false)
    limpiarBorrador()
    onAdquirido(vehiculo.id)
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0, font: '500 16px Georgia, serif' }}>Adquirir {evaluacion.marca} {evaluacion.modelo} {evaluacion.anio}</h3>
        <p style={{ margin: 0, fontSize: 12, color: '#8b8578' }}>Esto crea la unidad en Inventario y sale de Posibles ofertas.</p>
        <input required placeholder="Folio interno (ej. V-0001)" value={form.idInterno} onChange={(e) => set('idInterno', e.target.value)} style={inputStyle} />
        <input required type="number" step="0.01" placeholder="Precio pagado" value={form.precio} onChange={(e) => set('precio', e.target.value)} style={inputStyle} />
        <input required type="number" step="0.01" placeholder="Comisión de subasta" value={form.comision} onChange={(e) => set('comision', e.target.value)} style={inputStyle} />
        <input required type="date" value={form.fechaCompra} onChange={(e) => set('fechaCompra', e.target.value)} style={inputStyle} />
        {error && <div style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)' }}>{error}</div>}
        <FormBotones onClose={onClose} guardando={guardando} textoGuardar="Adquirir" />
      </form>
    </Modal>
  )
}
