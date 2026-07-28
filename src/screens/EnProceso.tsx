import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCatalogos } from '../lib/catalogos'
import { th, td, selectStyle } from '../lib/ui'
import type { VehiculoFicha } from '../types'

/**
 * Todas las unidades que todavía no llegan a "listo para venta"
 * (evaluación → comprado → traslado → diagnóstico → reparación →
 * preparación). Aquí se administra estado_proceso y ubicación para el
 * conjunto completo — no unidad por unidad en el alta, que solo ocurre
 * una vez.
 */
export default function EnProceso() {
  const { estados, ubicaciones, cargando: cargandoCatalogos } = useCatalogos()
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState<number | null>(null)

  async function recargar() {
    if (!supabase) return
    const { data } = await supabase.from('v_vehiculo_ficha').select('*').order('fecha_compra')
    setVehiculos((data ?? []) as VehiculoFicha[])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  const umbralListo = estados.find((e) => e.clave === 'listo')?.orden ?? 70
  const enProceso = vehiculos.filter((v) => {
    const estado = estados.find((e) => e.id === v.estado_proceso_id)
    return estado && !estado.es_final && estado.orden < umbralListo
  })

  async function cambiarEstado(vehiculoId: number, estadoProcesoId: number) {
    if (!supabase) return
    setGuardandoId(vehiculoId)
    await supabase.from('vehiculo').update({ estado_proceso_id: estadoProcesoId }).eq('id', vehiculoId)
    await recargar()
    setGuardandoId(null)
  }

  async function cambiarUbicacion(vehiculoId: number, ubicacionId: number) {
    if (!supabase) return
    setGuardandoId(vehiculoId)
    await supabase.from('vehiculo').update({ ubicacion_id: ubicacionId }).eq('id', vehiculoId)
    await recargar()
    setGuardandoId(null)
  }

  if (cargando || cargandoCatalogos) return <p>Cargando…</p>

  return (
    <div>
      <h1 style={{ font: '400 26px Georgia, serif', margin: '0 0 4px' }}>En proceso</h1>
      <p style={{ color: '#8b8578', fontSize: 12.5, marginTop: 0, marginBottom: 20 }}>
        {enProceso.length} unidades en desarrollo — desde evaluación hasta preparación.
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff' }}>
        <thead>
          <tr style={{ background: '#faf9f6' }}>{['Unidad', 'Días', 'Estado de proceso', 'Ubicación'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {enProceso.map((v) => {
            const dias = v.fecha_compra ? Math.floor((Date.now() - new Date(v.fecha_compra).getTime()) / 86400000) : null
            return (
              <tr key={v.id} style={{ borderTop: '1px solid #f0ede6', opacity: guardandoId === v.id ? 0.5 : 1 }}>
                <td style={td}>
                  <Link to={`/vehiculo/${v.id}`} style={{ color: '#1c1b19' }}>{v.marca} {v.modelo} {v.anio} <span style={{ color: '#8b8578' }}>· {v.id_interno}</span></Link>
                </td>
                <td style={td}>{dias ?? '—'}</td>
                <td style={td}>
                  <select value={v.estado_proceso_id} onChange={(e) => cambiarEstado(v.id, Number(e.target.value))} style={selectStyle}>
                    {estados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </td>
                <td style={td}>
                  <select value={v.ubicacion_id} onChange={(e) => cambiarUbicacion(v.id, Number(e.target.value))} style={selectStyle}>
                    {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                </td>
              </tr>
            )
          })}
          {enProceso.length === 0 && (
            <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#8b8578' }}>Sin unidades en proceso — todo está listo o vendido.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
