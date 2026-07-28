import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCatalogos } from '../lib/catalogos'
import { mxn } from '../lib/helpers'
import { th, td, selectStyle, inputStyle, btnSecundario } from '../lib/ui'
import { VentaModal } from './Ventas'
import type { VehiculoFicha, Venta, Cliente, Comisionista } from '../types'

const COMERCIAL_OPCIONES = ['no_publicado', 'publicado', 'en_consignacion', 'con_referidos', 'apartado', 'vendido']
const COMERCIAL_LABEL: Record<string, string> = {
  no_publicado: 'Sin publicar', publicado: 'Publicado', en_consignacion: 'En consignación',
  con_referidos: 'Con referidos', apartado: 'Apartado', vendido: 'Vendido',
}

/**
 * Unidades que ya llegaron a "listo para venta" y SIGUEN en proceso de
 * venderse (publicado/apartado/etc). En cuanto estado_comercial pasa a
 * 'vendido' el ciclo terminó — esa unidad ya no pertenece aquí, sale a
 * Vendidos. Aquí se administra estado_comercial, ubicación y el precio
 * publicado para el conjunto completo, y también se registra la venta
 * (botón "Registrar venta" — el resultado se ve en Ventas.tsx, que solo
 * muestra unidades que YA tienen una venta en curso, no las publicadas
 * sin comprador).
 */
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

  const veMinimo = perfil?.rol === 'admin'
  const puedeVender = perfil?.rol === 'admin' || perfil?.rol === 'gerencia'

  async function recargar() {
    if (!supabase) return
    const [v, ve, cl, cm] = await Promise.all([
      supabase.from('v_vehiculo_ficha').select('*').order('id_interno'),
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

  const umbralListo = estados.find((e) => e.clave === 'listo')?.orden ?? 70
  const enVenta = vehiculos.filter((v) => {
    if (v.estado_comercial === 'vendido') return false
    const estado = estados.find((e) => e.id === v.estado_proceso_id)
    return estado && !estado.es_final && estado.orden >= umbralListo
  })

  function tieneVentaEnCurso(vehiculoId: number) {
    return ventas.some((ve) => ve.vehiculo_id === vehiculoId && ve.estado !== 'cancelada')
  }

  async function actualizar(vehiculoId: number, cambios: Record<string, unknown>) {
    if (!supabase) return
    setGuardandoId(vehiculoId)
    await supabase.from('vehiculo').update(cambios).eq('id', vehiculoId)
    await recargar()
    setGuardandoId(null)
  }

  if (cargando || cargandoCatalogos) return <p>Cargando…</p>

  return (
    <div>
      <h1 style={{ font: '400 26px Georgia, serif', margin: '0 0 4px' }}>En venta</h1>
      <p style={{ color: '#8b8578', fontSize: 12.5, marginTop: 0, marginBottom: 20 }}>
        {enVenta.length} unidades listas o en proceso de venta.
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff' }}>
        <thead>
          <tr style={{ background: '#faf9f6' }}>
            {['Unidad', 'Estado comercial', 'Ubicación', 'Precio autorizado', veMinimo ? 'Precio mínimo' : null, puedeVender ? '' : null].filter((h) => h !== null).map((h, i) => <th key={i} style={th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {enVenta.map((v) => {
            const enCurso = tieneVentaEnCurso(v.id)
            return (
              <tr key={v.id} style={{ borderTop: '1px solid #f0ede6', opacity: guardandoId === v.id ? 0.5 : 1 }}>
                <td style={td}>
                  <Link to={`/vehiculo/${v.id}`} style={{ color: '#1c1b19' }}>{v.marca} {v.modelo} {v.anio} <span style={{ color: '#8b8578' }}>· {v.id_interno}</span></Link>
                </td>
                <td style={td}>
                  <select value={v.estado_comercial} onChange={(e) => actualizar(v.id, { estado_comercial: e.target.value })} style={selectStyle}>
                    {COMERCIAL_OPCIONES.map((o) => <option key={o} value={o}>{COMERCIAL_LABEL[o]}</option>)}
                  </select>
                </td>
                <td style={td}>
                  <select value={v.ubicacion_id} onChange={(e) => actualizar(v.id, { ubicacion_id: Number(e.target.value) })} style={selectStyle}>
                    {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <input
                    type="number"
                    defaultValue={v.precio_autorizado ?? ''}
                    onBlur={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null
                      if (val !== v.precio_autorizado) actualizar(v.id, { precio_autorizado: val })
                    }}
                    style={{ ...inputStyle, width: 110, textAlign: 'right' }}
                  />
                </td>
                {veMinimo && <td style={{ ...td, textAlign: 'right' }}>{mxn(v.precio_minimo)}</td>}
                {puedeVender && (
                  <td style={{ ...td, textAlign: 'right' }}>
                    {enCurso ? (
                      <span style={{ fontSize: 11.5, color: '#8b8578' }}>Venta en curso</span>
                    ) : (
                      <button onClick={() => setVentaParaRegistrar(v)} style={btnSecundario}>Registrar venta</button>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
          {enVenta.length === 0 && (
            <tr><td colSpan={veMinimo ? 6 : 5} style={{ padding: 20, textAlign: 'center', color: '#8b8578' }}>Sin unidades listas para venta todavía.</td></tr>
          )}
        </tbody>
      </table>

      {ventaParaRegistrar && (
        <VentaModal
          vehiculo={ventaParaRegistrar}
          clientes={clientes}
          comisionistas={comisionistas}
          onClose={() => setVentaParaRegistrar(null)}
          onGuardado={() => { setVentaParaRegistrar(null); recargar() }}
        />
      )}
    </div>
  )
}
