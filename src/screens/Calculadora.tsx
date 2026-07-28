import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { mxn, porcentaje } from '../lib/helpers'
import { inputStyle, th, td, btnPrimario, selectStyle } from '../lib/ui'
import type { EvaluacionPuja, RoiSegmento } from '../types'

// Comisión de subasta estándar (mismo valor por default que compra.comision
// en el esquema) — se usa como estimado de costos fijos al proyectar techo
// de puja antes de que exista la compra real.
const COMISION_SUBASTA = 5000

/** Calculadora de puja (RN-05): solo admin (evaluacion_admin, subasta_admin). */
export default function Calculadora() {
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionPuja[]>([])
  const [roiSegmento, setRoiSegmento] = useState<RoiSegmento[]>([])
  const [cargando, setCargando] = useState(true)

  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [anio, setAnio] = useState(String(new Date().getFullYear()))
  const [danos, setDanos] = useState('')
  const [costoReparacion, setCostoReparacion] = useState('')
  const [precioVenta, setPrecioVenta] = useState('')
  const [utilidadObjetivo, setUtilidadObjetivo] = useState('25000')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function recargar() {
    if (!supabase) return
    const [e, r] = await Promise.all([
      supabase.from('evaluacion_puja').select('*').order('created_at', { ascending: false }),
      supabase.from('v_roi_segmento').select('*'),
    ])
    setEvaluaciones((e.data ?? []) as EvaluacionPuja[])
    setRoiSegmento((r.data ?? []) as RoiSegmento[])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  const costoRep = Number(costoReparacion) || 0
  const precioEsp = Number(precioVenta) || 0
  const utilObj = Number(utilidadObjetivo) || 0
  const techoPuja = precioEsp - costoRep - COMISION_SUBASTA - utilObj
  const costoTotalProyectado = techoPuja + costoRep + COMISION_SUBASTA
  const roiProyectado = costoTotalProyectado > 0 ? utilObj / costoTotalProyectado : 0
  const margenProyectado = precioEsp > 0 ? utilObj / precioEsp : 0
  const banda = costoTotalProyectado < 110000 ? 'baja' : costoTotalProyectado < 180000 ? 'media' : 'alta'

  const historicoMismoModelo = roiSegmento.find(
    (r) => r.marca.toLowerCase() === marca.trim().toLowerCase() && r.modelo.toLowerCase() === modelo.trim().toLowerCase()
  )
  const historicoBanda = roiSegmento.filter((r) => r.banda === banda)
  const roiHistorico = historicoMismoModelo?.roi_promedio
    ?? (historicoBanda.length > 0 ? historicoBanda.reduce((acc, r) => acc + r.roi_promedio, 0) / historicoBanda.length : null)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    const { error } = await supabase.from('evaluacion_puja').insert({
      marca, modelo, anio: Number(anio),
      danos_observados: danos || null,
      costo_reparacion_estimado: costoRep,
      precio_venta_esperado: precioEsp,
      techo_puja: techoPuja,
      roi_proyectado: roiProyectado,
      roi_historico_segmento: roiHistorico,
    })
    setGuardando(false)
    if (error) { setError(error.message); return }
    setMarca(''); setModelo(''); setDanos(''); setCostoReparacion(''); setPrecioVenta('')
    recargar()
  }

  async function cambiarResultado(id: number, resultado: EvaluacionPuja['resultado']) {
    if (!supabase) return
    await supabase.from('evaluacion_puja').update({ resultado }).eq('id', id)
    recargar()
  }

  if (cargando) return <p>Cargando…</p>

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ font: '400 26px Georgia, serif', margin: '0 0 16px' }}>Calculadora de puja</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <form onSubmit={guardar} style={{ background: '#fff', border: '1px solid #e4e0d8', padding: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: 8 }}>
            <input required placeholder="Marca" value={marca} onChange={(e) => setMarca(e.target.value)} style={inputStyle} />
            <input required placeholder="Modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} style={inputStyle} />
            <input required type="number" placeholder="Año" value={anio} onChange={(e) => setAnio(e.target.value)} style={inputStyle} />
          </div>
          <input placeholder="Daños observados" value={danos} onChange={(e) => setDanos(e.target.value)} style={inputStyle} />
          <input required type="number" step="0.01" placeholder="Costo de reparación estimado" value={costoReparacion} onChange={(e) => setCostoReparacion(e.target.value)} style={inputStyle} />
          <input required type="number" step="0.01" placeholder="Precio de venta esperado" value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} style={inputStyle} />
          <input required type="number" step="0.01" placeholder="Utilidad objetivo" value={utilidadObjetivo} onChange={(e) => setUtilidadObjetivo(e.target.value)} style={inputStyle} />
          {error && <div style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)' }}>{error}</div>}
          <button type="submit" disabled={guardando} style={btnPrimario}>{guardando ? 'Guardando…' : 'Guardar evaluación'}</button>
        </form>

        <div style={{ background: '#faf9f6', border: '1px solid #e4e0d8', padding: 16 }}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8b8578', marginBottom: 10 }}>Resultado</div>
          <Dato label="Techo de puja sugerido" value={mxn(techoPuja)} destacado />
          <Dato label="Costo total proyectado" value={mxn(costoTotalProyectado)} />
          <Dato label="ROI proyectado" value={porcentaje(roiProyectado)} />
          <Dato label="Margen proyectado" value={porcentaje(margenProyectado)} />
          <Dato label={`ROI histórico (segmento ${banda})`} value={roiHistorico !== null ? porcentaje(roiHistorico) : 'Sin datos históricos'} />
          {techoPuja < 0 && (
            <p style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)', marginTop: 10 }}>
              El techo de puja es negativo: con estos supuestos no hay margen para pujar por esta unidad.
            </p>
          )}
        </div>
      </div>

      <h2 style={{ font: '500 15px "IBM Plex Sans"', borderBottom: '1.5px solid #26302f', paddingBottom: 8, margin: '28px 0 4px' }}>
        Evaluaciones registradas
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff' }}>
        <thead>
          <tr style={{ background: '#faf9f6' }}>{['Unidad', 'Techo de puja', 'ROI proyectado', 'Resultado'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {evaluaciones.map((e) => (
            <tr key={e.id} style={{ borderTop: '1px solid #f0ede6' }}>
              <td style={td}>{e.marca} {e.modelo} {e.anio}</td>
              <td style={{ ...td, textAlign: 'right' }}>{mxn(e.techo_puja)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{porcentaje(e.roi_proyectado)}</td>
              <td style={td}>
                <select value={e.resultado} onChange={(ev) => cambiarResultado(e.id, ev.target.value as EvaluacionPuja['resultado'])} style={selectStyle}>
                  <option value="pendiente">Pendiente</option>
                  <option value="ganada">Ganada</option>
                  <option value="perdida">Perdida</option>
                  <option value="descartada">Descartada</option>
                </select>
              </td>
            </tr>
          ))}
          {evaluaciones.length === 0 && <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#8b8578' }}>Sin evaluaciones registradas todavía.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function Dato({ label, value, destacado }: { label: string; value: string; destacado?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8b8578', marginBottom: 2 }}>{label}</div>
      <div style={{ font: destacado ? '400 22px Georgia, serif' : '400 15px Georgia, serif', color: '#1c1b19' }}>{value}</div>
    </div>
  )
}
