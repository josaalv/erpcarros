import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { mxn, porcentaje } from '../lib/helpers'
import { inputStyle, th, td, btnPrimario, btnSecundario } from '../lib/ui'
import { Modal, FormBotones } from '../components/Ui'
import type { Venta, VehiculoFicha, Cliente, Comisionista, CierreFinanciero, Comision } from '../types'

type VentaConVehiculo = Venta & { vehiculo?: { id_interno: string; marca: string; modelo: string; anio: number } | null }

const CANALES: Venta['canal'][] = ['directa', 'consignacion', 'comisionista', 'anuncio']
const FORMAS_PAGO: Venta['forma_pago'][] = ['efectivo', 'transferencia', 'financiera', 'toma_a_cuenta', 'mixto']

/**
 * Venta y cierre financiero. Registrar venta: admin/gerencia (venta_write).
 * Cerrar financiero y generar liquidación de socios: solo admin — es el
 * paso que reparte utilidad real, mismo criterio que RN-12 con precio_minimo.
 */
export default function Ventas() {
  const { perfil } = useAuth()
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [ventas, setVentas] = useState<VentaConVehiculo[]>([])
  const [cierres, setCierres] = useState<CierreFinanciero[]>([])
  const [comisiones, setComisiones] = useState<Comision[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [comisionistas, setComisionistas] = useState<Comisionista[]>([])
  const [cargando, setCargando] = useState(true)
  const [ventaParaRegistrar, setVentaParaRegistrar] = useState<VehiculoFicha | null>(null)
  const [cerrando, setCerrando] = useState<number | null>(null)
  const [errorCierre, setErrorCierre] = useState<string | null>(null)

  const esAdmin = perfil?.rol === 'admin'

  async function recargar() {
    if (!supabase) return
    const [v, ve, ci, co, cl, cm] = await Promise.all([
      supabase.from('v_vehiculo_ficha').select('*').order('id_interno'),
      supabase.from('venta').select('*, vehiculo:vehiculo_id(id_interno, marca, modelo, anio)').order('fecha_venta', { ascending: false }),
      supabase.from('cierre_financiero').select('*'),
      supabase.from('comision').select('*'),
      supabase.from('cliente').select('*').order('nombre'),
      supabase.from('comisionista').select('*').order('nombre'),
    ])
    setVehiculos((v.data ?? []) as VehiculoFicha[])
    setVentas((ve.data ?? []) as unknown as VentaConVehiculo[])
    setCierres((ci.data ?? []) as CierreFinanciero[])
    setComisiones((co.data ?? []) as Comision[])
    setClientes((cl.data ?? []) as Cliente[])
    setComisionistas((cm.data ?? []) as Comisionista[])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  const disponibles = vehiculos.filter((v) => v.estado_comercial !== 'vendido' && !ventas.some((ve) => ve.vehiculo_id === v.id && ve.estado !== 'cancelada'))

  async function cerrarFinanciero(venta: VentaConVehiculo) {
    if (!supabase) return
    setErrorCierre(null)
    setCerrando(venta.id)

    const [costoRes, aportRes, vehRes] = await Promise.all([
      supabase.from('v_costo_vehiculo').select('costo_total').eq('vehiculo_id', venta.vehiculo_id).maybeSingle(),
      supabase.from('v_participacion_socio').select('*').eq('vehiculo_id', venta.vehiculo_id),
      supabase.from('vehiculo').select('fecha_compra').eq('id', venta.vehiculo_id).maybeSingle(),
    ])

    const costoTotal = (costoRes.data as { costo_total: number } | null)?.costo_total ?? 0
    const fechaCompra = (vehRes.data as { fecha_compra: string | null } | null)?.fecha_compra
    const precioFinal = venta.precio_acordado
    const utilidadBruta = precioFinal - costoTotal
    const margen = precioFinal > 0 ? utilidadBruta / precioFinal : 0
    const roi = costoTotal > 0 ? utilidadBruta / costoTotal : 0
    const diasInventario = fechaCompra ? Math.floor((new Date(venta.fecha_venta).getTime() - new Date(fechaCompra).getTime()) / 86400000) : 0

    const { data: cierre, error: errCierre } = await supabase.from('cierre_financiero').insert({
      vehiculo_id: venta.vehiculo_id,
      venta_id: venta.id,
      costo_total: costoTotal,
      precio_final: precioFinal,
      utilidad_bruta: utilidadBruta,
      margen,
      roi,
      dias_inventario: diasInventario,
      canal_venta: venta.canal,
    }).select().single()

    if (errCierre || !cierre) {
      setCerrando(null)
      setErrorCierre(errCierre?.message ?? 'No se pudo cerrar.')
      return
    }

    const participaciones = (aportRes.data ?? []) as { vehiculo_id: number; socio_id: number; capital_aportado: number; participacion: number }[]
    if (participaciones.length > 0) {
      await supabase.from('liquidacion').insert(participaciones.map((p) => ({
        cierre_id: cierre.id,
        vehiculo_id: venta.vehiculo_id,
        socio_id: p.socio_id,
        capital_aportado: p.capital_aportado,
        participacion: p.participacion,
        utilidad_asignada: p.participacion * utilidadBruta,
        monto_a_pagar: p.capital_aportado + p.participacion * utilidadBruta,
      })))
    }

    if (venta.comisionista_id && !comisiones.some((c) => c.venta_id === venta.id)) {
      await supabase.from('comision').insert({ venta_id: venta.id, comisionista_id: venta.comisionista_id, esquema: 'fijo' })
    }

    await supabase.from('venta').update({ estado: 'completada' }).eq('id', venta.id)
    await supabase.from('vehiculo').update({ estado_comercial: 'vendido' }).eq('id', venta.vehiculo_id)

    setCerrando(null)
    recargar()
  }

  if (cargando) return <p>Cargando…</p>

  return (
    <div style={{ maxWidth: 960 }}>
      <h1 style={{ font: '400 26px Georgia, serif', margin: '0 0 16px' }}>Ventas y cierre financiero</h1>

      <h2 style={{ font: '500 15px "IBM Plex Sans"', borderBottom: '1.5px solid #26302f', paddingBottom: 8, marginBottom: 4 }}>
        Unidades disponibles
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff', marginBottom: 28 }}>
        <thead><tr style={{ background: '#faf9f6' }}>{['Unidad', 'Precio autorizado', ''].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {disponibles.map((v) => (
            <tr key={v.id} style={{ borderTop: '1px solid #f0ede6' }}>
              <td style={td}><Link to={`/vehiculo/${v.id}`} style={{ color: '#1c1b19' }}>{v.marca} {v.modelo} {v.anio} · {v.id_interno}</Link></td>
              <td style={{ ...td, textAlign: 'right' }}>{mxn(v.precio_autorizado)}</td>
              <td style={{ ...td, textAlign: 'right' }}><button onClick={() => setVentaParaRegistrar(v)} style={btnSecundario}>Registrar venta</button></td>
            </tr>
          ))}
          {disponibles.length === 0 && <tr><td colSpan={3} style={{ padding: 16, textAlign: 'center', color: '#8b8578' }}>Todas las unidades activas ya tienen venta registrada.</td></tr>}
        </tbody>
      </table>

      <h2 style={{ font: '500 15px "IBM Plex Sans"', borderBottom: '1.5px solid #26302f', paddingBottom: 8, marginBottom: 4 }}>
        Ventas registradas
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff' }}>
        <thead>
          <tr style={{ background: '#faf9f6' }}>{['Unidad', 'Canal', 'Precio acordado', 'Estado', esAdmin ? 'Cierre financiero' : null].filter(Boolean).map((h) => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {ventas.map((v) => {
            const cierre = cierres.find((c) => c.venta_id === v.id)
            return (
              <tr key={v.id} style={{ borderTop: '1px solid #f0ede6' }}>
                <td style={td}>
                  <Link to={`/vehiculo/${v.vehiculo_id}`} style={{ color: '#1c1b19' }}>
                    {v.vehiculo ? `${v.vehiculo.id_interno} · ${v.vehiculo.marca} ${v.vehiculo.modelo}` : `#${v.vehiculo_id}`}
                  </Link>
                </td>
                <td style={td}>{v.canal}</td>
                <td style={{ ...td, textAlign: 'right' }}>{mxn(v.precio_acordado)}</td>
                <td style={td}>{v.estado}</td>
                {esAdmin && (
                  <td style={td}>
                    {cierre ? (
                      <span style={{ color: 'oklch(0.45 0.09 150)' }}>
                        Cerrado · utilidad {mxn(cierre.utilidad_bruta)} · margen {porcentaje(cierre.margen)}
                      </span>
                    ) : v.estado === 'cancelada' ? '—' : (
                      <button onClick={() => cerrarFinanciero(v)} disabled={cerrando === v.id} style={btnPrimario}>
                        {cerrando === v.id ? 'Cerrando…' : 'Cerrar financiero'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
          {ventas.length === 0 && <tr><td colSpan={esAdmin ? 5 : 4} style={{ padding: 16, textAlign: 'center', color: '#8b8578' }}>Sin ventas registradas todavía.</td></tr>}
        </tbody>
      </table>
      {errorCierre && <p style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)', marginTop: 8 }}>{errorCierre}</p>}

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

function VentaModal({ vehiculo, clientes, comisionistas, onClose, onGuardado }: {
  vehiculo: VehiculoFicha
  clientes: Cliente[]
  comisionistas: Comisionista[]
  onClose: () => void
  onGuardado: () => void
}) {
  const [clienteId, setClienteId] = useState('')
  const [comisionistaId, setComisionistaId] = useState('')
  const [canal, setCanal] = useState<Venta['canal']>('directa')
  const [precio, setPrecio] = useState(vehiculo.precio_autorizado ? String(vehiculo.precio_autorizado) : '')
  const [formaPago, setFormaPago] = useState<Venta['forma_pago']>('transferencia')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    const { error } = await supabase.from('venta').insert({
      vehiculo_id: vehiculo.id,
      cliente_id: clienteId ? Number(clienteId) : null,
      comisionista_id: comisionistaId ? Number(comisionistaId) : null,
      canal, precio_acordado: Number(precio), forma_pago: formaPago, fecha_venta: fecha,
    })
    setGuardando(false)
    if (error) { setError(error.message); return }
    onGuardado()
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0, font: '500 16px Georgia, serif' }}>Registrar venta</h3>
        <p style={{ margin: 0, fontSize: 12, color: '#8b8578' }}>{vehiculo.marca} {vehiculo.modelo} {vehiculo.anio} · {vehiculo.id_interno}</p>

        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={inputStyle}>
          <option value="">Cliente (opcional)…</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select value={comisionistaId} onChange={(e) => setComisionistaId(e.target.value)} style={inputStyle}>
          <option value="">Comisionista (opcional)…</option>
          {comisionistas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select value={canal} onChange={(e) => setCanal(e.target.value as Venta['canal'])} style={inputStyle}>
          {CANALES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input required type="number" step="0.01" placeholder="Precio acordado" value={precio} onChange={(e) => setPrecio(e.target.value)} style={inputStyle} />
        <select value={formaPago} onChange={(e) => setFormaPago(e.target.value as Venta['forma_pago'])} style={inputStyle}>
          {FORMAS_PAGO.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <input required type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputStyle} />

        {error && <div style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)' }}>{error}</div>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}
