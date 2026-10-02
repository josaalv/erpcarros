import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCatalogos } from '../lib/catalogos'
import { diasDesde } from '../lib/helpers'
import { PageHeader, Alerta, Cargando, NombreUnidad } from '../components/Ui'
import type { VehiculoFicha } from '../types'

/** Unidades antes de "listo para venta": aquí se cambia su etapa y ubicación. */
export default function EnProceso() {
  const { estados, ubicaciones, cargando: cargandoCatalogos } = useCatalogos()
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function recargar() {
    if (!supabase) return
    const { data } = await supabase.from('v_vehiculo_ficha').select('*').neq('estado_comercial', 'vendido').order('fecha_compra')
    setVehiculos((data ?? []) as VehiculoFicha[])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  async function actualizar(vehiculoId: number, cambios: Record<string, unknown>) {
    if (!supabase) return
    setGuardandoId(vehiculoId)
    setError(null)
    const { error } = await supabase.from('vehiculo').update(cambios).eq('id', vehiculoId)
    if (error) setError(`No se pudo guardar el cambio: ${error.message}`)
    await recargar()
    setGuardandoId(null)
  }

  if (cargando || cargandoCatalogos) return <Cargando />

  const umbralListo = estados.find((e) => e.clave === 'listo')?.orden ?? 70
  const enProceso = vehiculos.filter((v) => {
    const estado = estados.find((e) => e.id === v.estado_proceso_id)
    return estado && !estado.es_final && estado.orden < umbralListo
  })

  return (
    <div>
      <PageHeader
        titulo="En proceso"
        descripcion={`${enProceso.length} unidades en preparación. Cuando una llegue a "Listo para venta" pasa automáticamente a En venta.`}
      />

      {error && <div style={{ marginBottom: 16 }}><Alerta>{error}</Alerta></div>}

      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr><th>Unidad</th><th className="num">Días</th><th>Etapa</th><th>Ubicación</th></tr>
          </thead>
          <tbody>
            {enProceso.map((v) => (
              <tr key={v.id} className={guardandoId === v.id ? 'ocupado' : ''}>
                <td><NombreUnidad v={v} /></td>
                <td className="num">{diasDesde(v.fecha_compra) ?? '—'}</td>
                <td>
                  <select className="select select-chico" value={v.estado_proceso_id} disabled={guardandoId === v.id}
                    onChange={(e) => actualizar(v.id, { estado_proceso_id: Number(e.target.value) })}>
                    {estados.filter((e) => !e.es_final).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </td>
                <td>
                  <select className="select select-chico" value={v.ubicacion_id} disabled={guardandoId === v.id}
                    onChange={(e) => actualizar(v.id, { ubicacion_id: Number(e.target.value) })}>
                    {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {enProceso.length === 0 && <tr><td colSpan={4} className="vacio">No hay unidades en preparación.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
