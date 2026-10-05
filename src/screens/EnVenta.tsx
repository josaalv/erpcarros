import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCatalogos } from '../lib/catalogos'
import { mxn, numeroONull, diasDesde, ESTADO_COMERCIAL } from '../lib/helpers'
import { PageHeader, Alerta, Cargando, NombreUnidad, Badge, DiasBadge } from '../components/Ui'
import { BarraMasiva } from '../components/Masivo'
import { useSeleccion } from '../lib/useSeleccion'
import { VentaModal } from '../components/VentaModal'
import type { VehiculoFicha, Venta, Cliente, Comisionista } from '../types'

// 'vendido' no se elige aquí: lo pone el cierre financiero en Ventas.
const COMERCIAL_EDITABLES = ['no_publicado', 'publicado', 'en_consignacion', 'con_referidos', 'apartado']

/** Unidades listas para vender y aún no vendidas: precio, ubicación, estado y registrar venta. */
export default function EnVenta() {
  const { perfil } = useAuth()
  const { estados, ubicaciones, cargando: cargandoCatalogos } = useCatalogos()
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [ventas, setVentas] = useState<Pick<Venta, 'vehiculo_id' | 'estado'>[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [comisionistas, setComisionistas] = useState<Comisionista[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState<number | null>(null)
  const [ventaParaRegistrar, setVentaParaRegistrar] = useState<VehiculoFicha | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroComercial, setFiltroComercial] = useState('')
  const [filtroUbicacion, setFiltroUbicacion] = useState('')
  const [aplicando, setAplicando] = useState(false)

  const veMinimo = perfil?.rol === 'admin'
  const puedeVender = perfil?.rol === 'admin' || perfil?.rol === 'gerencia'

  async function recargar() {
    if (!supabase) return
    const [v, ve, cl, cm] = await Promise.all([
      supabase.from('v_vehiculo_ficha').select('*').neq('estado_comercial', 'vendido').order('id_interno'),
      supabase.from('venta').select('vehiculo_id, estado'),
      supabase.from('cliente').select('*').order('nombre'),
      supabase.from('comisionista').select('*').order('nombre'),
    ])
    setVehiculos((v.data ?? []) as VehiculoFicha[])
    setVentas((ve.data ?? []) as Pick<Venta, 'vehiculo_id' | 'estado'>[])
    setClientes((cl.data ?? []) as Cliente[])
    setComisionistas((cm.data ?? []) as Comisionista[])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  async function actualizar(vehiculoId: number, cambios: Record<string, unknown>) {
    if (!supabase) return
    setGuardandoId(vehiculoId)
    setError(null)
    setAviso(null)
    const { error } = await supabase.from('vehiculo').update(cambios).eq('id', vehiculoId)
    if (error) setError(`No se pudo guardar el cambio: ${error.message}`)
    await recargar()
    setGuardandoId(null)
  }

  const umbralListo = estados.find((e) => e.clave === 'listo')?.orden ?? 70
  const enVenta = vehiculos.filter((v) => {
    const estado = estados.find((e) => e.id === v.estado_proceso_id)
    return estado && !estado.es_final && estado.orden >= umbralListo
  })
  const q = busqueda.trim().toLowerCase()
  const visibles = enVenta.filter((v) =>
    (!q || `${v.id_interno} ${v.marca} ${v.modelo} ${v.anio} ${v.vin ?? ''}`.toLowerCase().includes(q))
    && (!filtroComercial || v.estado_comercial === filtroComercial)
    && (!filtroUbicacion || String(v.ubicacion_id) === filtroUbicacion))
  const sel = useSeleccion(visibles.map((v) => v.id))

  async function aplicarMasivo(cambios: Record<string, unknown>) {
    if (!supabase) return
    setAplicando(true)
    setError(null)
    setAviso(null)
    const ids = sel.seleccion
    const { error } = await supabase.from('vehiculo').update(cambios).in('id', ids)
    if (error) setError(`No se pudo aplicar el cambio: ${error.message}`)
    else { setAviso(`${ids.length} unidades actualizadas.`); sel.limpiar() }
    await recargar()
    setAplicando(false)
  }

  if (cargando || cargandoCatalogos) return <Cargando />
  const ventaEnCurso = (vid: number) => ventas.some((ve) => ve.vehiculo_id === vid && ve.estado === 'en_proceso')

  return (
    <div>
      <PageHeader
        titulo="En venta"
        descripcion={`${enVenta.length} unidades listas para vender. Ajusta precio y estado aquí; cuando haya comprador, registra la venta.`}
      />

      {error && <div style={{ marginBottom: 16 }}><Alerta>{error}</Alerta></div>}
      {aviso && <div style={{ marginBottom: 16 }}><Alerta tipo="ok">{aviso}</Alerta></div>}

      <div className="filtros">
        <input className="input" placeholder="Buscar por marca, modelo, folio o serie…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <select className="select" value={filtroComercial} onChange={(e) => setFiltroComercial(e.target.value)}>
          <option value="">Todos los estados</option>
          {COMERCIAL_EDITABLES.map((o) => <option key={o} value={o}>{ESTADO_COMERCIAL[o].label}</option>)}
        </select>
        <select className="select" value={filtroUbicacion} onChange={(e) => setFiltroUbicacion(e.target.value)}>
          <option value="">Todas las ubicaciones</option>
          {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        {visibles.length !== enVenta.length && <span className="texto-suave filtros-cuenta">{visibles.length} de {enVenta.length}</span>}
      </div>

      <BarraMasiva
        cantidad={sel.seleccion.length}
        ocupado={aplicando}
        onLimpiar={sel.limpiar}
        onAplicar={aplicarMasivo}
        campos={[
          { clave: 'estado_comercial', label: 'Estado', opciones: COMERCIAL_EDITABLES.map((o) => ({ valor: o, label: ESTADO_COMERCIAL[o].label })) },
          { clave: 'ubicacion_id', label: 'Ubicación', convertir: Number, opciones: ubicaciones.filter((u) => u.activo).map((u) => ({ valor: String(u.id), label: u.nombre })) },
          { clave: 'estado_proceso_id', label: 'Etapa', convertir: Number, opciones: estados.filter((e) => !e.es_final && e.activo).map((e) => ({ valor: String(e.id), label: e.nombre })) },
        ]}
      />

      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              <th className="col-check"><input type="checkbox" aria-label="Seleccionar todas" checked={sel.todos} onChange={sel.alternarTodos} /></th>
              <th>Unidad</th>
              <th>Etapa</th>
              <th>Estado comercial</th>
              <th>Ubicación</th>
              <th className="num">Precio autorizado</th>
              {puedeVender && <th></th>}
            </tr>
          </thead>
          <tbody>
            {visibles.map((v) => {
              const enCurso = ventaEnCurso(v.id)
              const ocupado = guardandoId === v.id
              return (
                <tr key={v.id} className={ocupado ? 'ocupado' : ''}>
                  <td className="col-check"><input type="checkbox" aria-label={`Seleccionar ${v.id_interno}`} checked={sel.marcado(v.id)} onChange={() => sel.alternar(v.id)} /></td>
                  <td>
                    <NombreUnidad v={v} />
                    <DiasBadge dias={diasDesde(v.fecha_compra)} />
                  </td>
                  <td>
                    <select className="select select-chico" value={v.estado_proceso_id} disabled={ocupado}
                      title="Si la regresas a una etapa anterior, vuelve a En proceso"
                      onChange={(e) => actualizar(v.id, { estado_proceso_id: Number(e.target.value) })}>
                      {estados.filter((e) => !e.es_final && (e.activo || e.id === v.estado_proceso_id)).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="select select-chico" value={v.estado_comercial} disabled={ocupado}
                      onChange={(e) => actualizar(v.id, { estado_comercial: e.target.value })}>
                      {COMERCIAL_EDITABLES.map((o) => <option key={o} value={o}>{ESTADO_COMERCIAL[o].label}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="select select-chico" value={v.ubicacion_id} disabled={ocupado}
                      onChange={(e) => actualizar(v.id, { ubicacion_id: Number(e.target.value) })}>
                      {ubicaciones.filter((u) => u.activo || u.id === v.ubicacion_id).map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                    </select>
                  </td>
                  <td className="num">
                    <input
                      key={`${v.id}-${v.precio_autorizado}`}
                      className="input input-chico input-num"
                      type="number" min={0} style={{ width: 140 }}
                      defaultValue={v.precio_autorizado ?? ''}
                      disabled={ocupado}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                      onBlur={(e) => {
                        const val = numeroONull(e.target.value)
                        if (val !== v.precio_autorizado) actualizar(v.id, { precio_autorizado: val })
                      }}
                    />
                    {veMinimo && <span className="unidad-folio">Mínimo {mxn(v.precio_minimo)}</span>}
                  </td>
                  {puedeVender && (
                    <td className="acciones-celda">
                      {enCurso
                        ? <Badge tono="aviso">Venta en curso</Badge>
                        : <button className="btn btn-primario btn-chico" onClick={() => setVentaParaRegistrar(v)}>Registrar venta</button>}
                    </td>
                  )}
                </tr>
              )
            })}
            {visibles.length === 0 && <tr><td colSpan={7} className="vacio">{enVenta.length ? 'Ninguna unidad coincide con los filtros.' : 'No hay unidades listas para vender.'}</td></tr>}
          </tbody>
        </table>
      </div>

      {ventaParaRegistrar && (
        <VentaModal
          vehiculo={ventaParaRegistrar}
          clientes={clientes}
          comisionistas={comisionistas}
          onClose={() => setVentaParaRegistrar(null)}
          onGuardado={() => { setVentaParaRegistrar(null); setAviso('Venta registrada. Ciérrala desde Ventas para calcular la utilidad.'); recargar() }}
        />
      )}
    </div>
  )
}
