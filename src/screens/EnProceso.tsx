import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCatalogos } from '../lib/catalogos'
import { diasDesde } from '../lib/helpers'
import { PageHeader, Alerta, Cargando, NombreUnidad, DiasBadge } from '../components/Ui'
import { BarraMasiva } from '../components/Masivo'
import { useSeleccion } from '../lib/useSeleccion'
import type { VehiculoFicha } from '../types'

/** Unidades antes de "listo para venta": aquí se cambia su etapa y ubicación. */
export default function EnProceso() {
  const { estados, ubicaciones, cargando: cargandoCatalogos } = useCatalogos()
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEtapa, setFiltroEtapa] = useState('')
  const [filtroUbicacion, setFiltroUbicacion] = useState('')
  const [aplicando, setAplicando] = useState(false)

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

  const umbralListo = estados.find((e) => e.clave === 'listo')?.orden ?? 70
  const enProceso = vehiculos.filter((v) => {
    const estado = estados.find((e) => e.id === v.estado_proceso_id)
    return estado && !estado.es_final && estado.orden < umbralListo
  })
  const q = busqueda.trim().toLowerCase()
  const visibles = enProceso.filter((v) =>
    (!q || `${v.id_interno} ${v.marca} ${v.modelo} ${v.anio} ${v.vin ?? ''} ${v.torre ?? ''}`.toLowerCase().includes(q))
    && (!filtroEtapa || String(v.estado_proceso_id) === filtroEtapa)
    && (!filtroUbicacion || String(v.ubicacion_id) === filtroUbicacion))
  const sel = useSeleccion(visibles.map((v) => v.id))

  async function aplicarMasivo(cambios: Record<string, unknown>) {
    if (!supabase) return
    setAplicando(true)
    setError(null)
    setAviso(null)
    const ids = sel.seleccion
    // Una sola sentencia: o se actualizan todas o ninguna.
    const { error } = await supabase.from('vehiculo').update(cambios).in('id', ids)
    if (error) setError(`No se pudo aplicar el cambio: ${error.message}`)
    else { setAviso(`${ids.length} unidades actualizadas.`); sel.limpiar() }
    await recargar()
    setAplicando(false)
  }

  if (cargando || cargandoCatalogos) return <Cargando />

  const etapasEditables = estados.filter((e) => !e.es_final && e.activo)

  return (
    <div>
      <PageHeader
        titulo="En proceso"
        descripcion={`${enProceso.length} unidades en preparación. Cuando una llegue a "Listo para venta" pasa automáticamente a En venta.`}
      />

      {error && <div style={{ marginBottom: 16 }}><Alerta>{error}</Alerta></div>}
      {aviso && <div style={{ marginBottom: 16 }}><Alerta tipo="ok">{aviso}</Alerta></div>}

      <div className="filtros">
        <input className="input" placeholder="Buscar por marca, modelo, folio, serie o torre…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <select className="select" value={filtroEtapa} onChange={(e) => setFiltroEtapa(e.target.value)}>
          <option value="">Todas las etapas</option>
          {estados.filter((e) => !e.es_final && e.orden < umbralListo).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <select className="select" value={filtroUbicacion} onChange={(e) => setFiltroUbicacion(e.target.value)}>
          <option value="">Todas las ubicaciones</option>
          {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        {visibles.length !== enProceso.length && <span className="texto-suave filtros-cuenta">{visibles.length} de {enProceso.length}</span>}
      </div>

      <BarraMasiva
        cantidad={sel.seleccion.length}
        ocupado={aplicando}
        onLimpiar={sel.limpiar}
        onAplicar={aplicarMasivo}
        campos={[
          { clave: 'estado_proceso_id', label: 'Etapa', convertir: Number, opciones: etapasEditables.map((e) => ({ valor: String(e.id), label: e.nombre })) },
          { clave: 'ubicacion_id', label: 'Ubicación', convertir: Number, opciones: ubicaciones.filter((u) => u.activo).map((u) => ({ valor: String(u.id), label: u.nombre })) },
        ]}
      />

      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              <th className="col-check"><input type="checkbox" aria-label="Seleccionar todas" checked={sel.todos} onChange={sel.alternarTodos} /></th>
              <th>Unidad</th><th>Días</th><th>Etapa</th><th>Ubicación</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((v) => (
              <tr key={v.id} className={guardandoId === v.id ? 'ocupado' : ''}>
                <td className="col-check"><input type="checkbox" aria-label={`Seleccionar ${v.id_interno}`} checked={sel.marcado(v.id)} onChange={() => sel.alternar(v.id)} /></td>
                <td><NombreUnidad v={v} /></td>
                <td><DiasBadge dias={diasDesde(v.fecha_compra)} /></td>
                <td>
                  <select className="select select-chico" value={v.estado_proceso_id} disabled={guardandoId === v.id}
                    onChange={(e) => actualizar(v.id, { estado_proceso_id: Number(e.target.value) })}>
                    {estados.filter((e) => !e.es_final && (e.activo || e.id === v.estado_proceso_id)).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </td>
                <td>
                  <select className="select select-chico" value={v.ubicacion_id} disabled={guardandoId === v.id}
                    onChange={(e) => actualizar(v.id, { ubicacion_id: Number(e.target.value) })}>
                    {ubicaciones.filter((u) => u.activo || u.id === v.ubicacion_id).map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {visibles.length === 0 && <tr><td colSpan={5} className="vacio">{enProceso.length ? 'Ninguna unidad coincide con los filtros.' : 'No hay unidades en preparación.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
