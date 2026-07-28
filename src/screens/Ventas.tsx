import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useBorrador } from '../lib/useBorrador'
import { mxn, porcentaje } from '../lib/helpers'
import { inputStyle, th, td, btnPrimario } from '../lib/ui'
import { Modal, FormBotones } from '../components/Ui'
import type { Venta, VehiculoFicha, Cliente, Comisionista, CierreFinanciero, Comision } from '../types'

type VentaConVehiculo = Venta & { vehiculo?: { id_interno: string; marca: string; modelo: string; anio: number } | null }

export const CANALES: Venta['canal'][] = ['directa', 'consignacion', 'comisionista', 'anuncio']
const FORMAS_PAGO: Venta['forma_pago'][] = ['efectivo', 'transferencia', 'financiera', 'toma_a_cuenta', 'mixto']

/**
 * Cierre financiero de ventas ya registradas — solo muestra unidades que
 * YA tienen una venta en curso (cambiando su estado hacia vendido), no las
 * que están simplemente publicadas sin comprador todavía. "Registrar
 * venta" vive en "En venta" (EnVenta.tsx), junto a donde se administra el
 * resto del estado comercial de las unidades listas para vender —
 * VentaModal se exporta desde aquí para que ambas pantallas la reutilicen.
 * Cerrar financiero y generar liquidación de socios: solo admin — es el
 * paso que reparte utilidad real, mismo criterio que RN-12 con precio_minimo.
 */
export default function Ventas() {
  const { perfil, session } = useAuth()
  const [ventas, setVentas] = useState<VentaConVehiculo[]>([])
  const [cierres, setCierres] = useState<CierreFinanciero[]>([])
  const [comisiones, setComisiones] = useState<Comision[]>([])
  const [cargando, setCargando] = useState(true)
  const [cerrando, setCerrando] = useState<number | null>(null)
  const [errorCierre, setErrorCierre] = useState<string | null>(null)

  const esAdmin = perfil?.rol === 'admin'

  async function recargar() {
    if (!supabase) return
    const [ve, ci, co] = await Promise.all([
      supabase.from('venta').select('*, vehiculo:vehiculo_id(id_interno, marca, modelo, anio)').order('fecha_venta', { ascending: false }),
      supabase.from('cierre_financiero').select('*'),
      supabase.from('comision').select('*'),
    ])
    setVentas((ve.data ?? []) as unknown as VentaConVehiculo[])
    setCierres((ci.data ?? []) as CierreFinanciero[])
    setComisiones((co.data ?? []) as Comision[])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  async function cerrarFinanciero(venta: VentaConVehiculo) {
    if (!supabase || !session) return
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
      cerrado_por: session.user.id,
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
      <h1 style={{ font: '400 26px Georgia, serif', margin: '0 0 4px' }}>Ventas y cierre financiero</h1>
      <p style={{ color: '#8b8578', fontSize: 12.5, marginTop: 0, marginBottom: 20 }}>
        Unidades que ya tienen una venta en curso. Para registrar una venta nueva, ve a "En venta".
      </p>

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
    </div>
  )
}

export function VentaModal({ vehiculo, clientes, comisionistas, onClose, onGuardado }: {
  vehiculo: VehiculoFicha
  clientes: Cliente[]
  comisionistas: Comisionista[]
  onClose: () => void
  onGuardado: () => void
}) {
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:venta:${vehiculo.id}`, {
    clienteId: '', comisionistaId: '', comisionMonto: '',
    canal: 'directa' as Venta['canal'],
    precio: vehiculo.precio_autorizado ? String(vehiculo.precio_autorizado) : '',
    formaPago: 'transferencia' as Venta['forma_pago'],
    fecha: new Date().toISOString().slice(0, 10),
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    const { data: venta, error: errVenta } = await supabase.from('venta').insert({
      vehiculo_id: vehiculo.id,
      cliente_id: form.clienteId ? Number(form.clienteId) : null,
      comisionista_id: form.comisionistaId ? Number(form.comisionistaId) : null,
      canal: form.canal, precio_acordado: Number(form.precio), forma_pago: form.formaPago, fecha_venta: form.fecha,
    }).select().single()

    if (errVenta || !venta) {
      setGuardando(false)
      setError(errVenta?.message ?? 'No se pudo registrar la venta.')
      return
    }

    if (form.comisionistaId) {
      await supabase.from('comision').insert({
        venta_id: venta.id,
        comisionista_id: Number(form.comisionistaId),
        esquema: 'fijo',
        monto_estimado: form.comisionMonto ? Number(form.comisionMonto) : null,
      })
    }

    setGuardando(false)
    limpiarBorrador()
    onGuardado()
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0, font: '500 16px Georgia, serif' }}>Registrar venta</h3>
        <p style={{ margin: 0, fontSize: 12, color: '#8b8578' }}>{vehiculo.marca} {vehiculo.modelo} {vehiculo.anio} · {vehiculo.id_interno}</p>

        <select value={form.clienteId} onChange={(e) => set('clienteId', e.target.value)} style={inputStyle}>
          <option value="">Cliente (opcional)…</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select value={form.comisionistaId} onChange={(e) => set('comisionistaId', e.target.value)} style={inputStyle}>
          <option value="">Comisionista (opcional)…</option>
          {comisionistas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        {form.comisionistaId && (
          <input type="number" step="0.01" placeholder="Monto de comisión (opcional)" value={form.comisionMonto} onChange={(e) => set('comisionMonto', e.target.value)} style={inputStyle} />
        )}
        <select value={form.canal} onChange={(e) => set('canal', e.target.value as Venta['canal'])} style={inputStyle}>
          {CANALES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input required type="number" step="0.01" placeholder="Precio acordado" value={form.precio} onChange={(e) => set('precio', e.target.value)} style={inputStyle} />
        <select value={form.formaPago} onChange={(e) => set('formaPago', e.target.value as Venta['forma_pago'])} style={inputStyle}>
          {FORMAS_PAGO.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <input required type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} style={inputStyle} />

        {error && <div style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)' }}>{error}</div>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}
