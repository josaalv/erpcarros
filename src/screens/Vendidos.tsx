import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useBorrador } from '../lib/useBorrador'
import { mxn, porcentaje } from '../lib/helpers'
import { th, td, inputStyle, selectStyle, btnSecundario } from '../lib/ui'
import { Modal, FormBotones } from '../components/Ui'
import { CANALES } from './Ventas'
import type { VehiculoFicha, Venta, CierreFinanciero, Comision } from '../types'

type VentaConComisionista = Venta & { comisionista?: { nombre: string } | null }

/**
 * Etapa 4 del ciclo: el vehículo ya se vendió. Sección propia, separada de
 * Inventario (que solo muestra unidades activas) — aquí vive la
 * información final de cada venta: precio final, comisión (si aplica) y el
 * cierre financiero ya calculado en Ventas.tsx. Editable, no solo lectura:
 * canal/precio/fecha de la venta (admin/gerencia) y monto/fecha de pago de
 * la comisión (admin) se corrigen aquí mismo. Si el cierre financiero ya
 * está cerrado, "Recalcular cierre" lo reabre (tabla reapertura, ya existía
 * en el esquema sin usarse) y genera uno nuevo con los números corregidos.
 */
export default function Vendidos() {
  const { perfil, session } = useAuth()
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [ventas, setVentas] = useState<VentaConComisionista[]>([])
  const [cierres, setCierres] = useState<CierreFinanciero[]>([])
  const [comisiones, setComisiones] = useState<Comision[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState<number | null>(null)
  const [reabriendo, setReabriendo] = useState<{ venta: VentaConComisionista; cierre: CierreFinanciero } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const veFinanciero = perfil?.rol === 'admin'
  const puedeEditarVenta = perfil?.rol === 'admin' || perfil?.rol === 'gerencia'
  const puedeEditarComision = perfil?.rol === 'admin'

  async function recargar() {
    if (!supabase) return
    const [v, ve, ci, co] = await Promise.all([
      supabase.from('v_vehiculo_ficha').select('*').eq('estado_comercial', 'vendido').order('id_interno'),
      supabase.from('venta').select('*, comisionista:comisionista_id(nombre)').eq('estado', 'completada'),
      supabase.from('cierre_financiero').select('*'),
      supabase.from('comision').select('*'),
    ])
    setVehiculos((v.data ?? []) as VehiculoFicha[])
    setVentas((ve.data ?? []) as unknown as VentaConComisionista[])
    setCierres((ci.data ?? []) as CierreFinanciero[])
    setComisiones((co.data ?? []) as Comision[])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  async function actualizarVenta(ventaId: number, cambios: Record<string, unknown>) {
    if (!supabase) return
    setGuardandoId(ventaId)
    setError(null)
    const { error: errActualizar } = await supabase.from('venta').update(cambios).eq('id', ventaId)
    if (errActualizar) setError(errActualizar.message)
    await recargar()
    setGuardandoId(null)
  }

  async function actualizarComision(comisionId: number, cambios: Record<string, unknown>) {
    if (!supabase) return
    setGuardandoId(comisionId)
    setError(null)
    const { error: errActualizar } = await supabase.from('comision').update(cambios).eq('id', comisionId)
    if (errActualizar) setError(errActualizar.message)
    await recargar()
    setGuardandoId(null)
  }

  async function recalcularCierre(venta: VentaConComisionista, cierre: CierreFinanciero, motivo: string) {
    if (!supabase || !session) return 'Supabase no está configurado.'

    const { error: errReapertura } = await supabase.from('reapertura').insert({
      cierre_id: cierre.id, motivo, usuario_id: session.user.id,
    })
    if (errReapertura) return errReapertura.message

    const [costoRes, aportRes] = await Promise.all([
      supabase.from('v_costo_vehiculo').select('costo_total').eq('vehiculo_id', venta.vehiculo_id).maybeSingle(),
      supabase.from('v_participacion_socio').select('*').eq('vehiculo_id', venta.vehiculo_id),
    ])
    const costoTotal = (costoRes.data as { costo_total: number } | null)?.costo_total ?? 0
    const precioFinal = venta.precio_acordado
    const utilidadBruta = precioFinal - costoTotal
    const margen = precioFinal > 0 ? utilidadBruta / precioFinal : 0
    const roi = costoTotal > 0 ? utilidadBruta / costoTotal : 0

    const { error: errBorrar } = await supabase.from('cierre_financiero').delete().eq('id', cierre.id)
    if (errBorrar) return errBorrar.message

    const { data: nuevoCierre, error: errCrear } = await supabase.from('cierre_financiero').insert({
      vehiculo_id: venta.vehiculo_id,
      venta_id: venta.id,
      costo_total: costoTotal,
      precio_final: precioFinal,
      utilidad_bruta: utilidadBruta,
      margen,
      roi,
      dias_inventario: cierre.dias_inventario,
      canal_venta: venta.canal,
      estado: 'reabierto',
      cerrado_por: session.user.id,
    }).select().single()
    if (errCrear || !nuevoCierre) return errCrear?.message ?? 'No se pudo recalcular el cierre.'

    const participaciones = (aportRes.data ?? []) as { socio_id: number; capital_aportado: number; participacion: number }[]
    if (participaciones.length > 0) {
      await supabase.from('liquidacion').insert(participaciones.map((p) => ({
        cierre_id: nuevoCierre.id,
        vehiculo_id: venta.vehiculo_id,
        socio_id: p.socio_id,
        capital_aportado: p.capital_aportado,
        participacion: p.participacion,
        utilidad_asignada: p.participacion * utilidadBruta,
        monto_a_pagar: p.capital_aportado + p.participacion * utilidadBruta,
      })))
    }
    return null
  }

  if (cargando) return <p>Cargando…</p>

  return (
    <div>
      <h1 style={{ font: '400 26px Georgia, serif', margin: '0 0 4px' }}>Vendidos</h1>
      <p style={{ color: '#8b8578', fontSize: 12.5, marginTop: 0, marginBottom: 20 }}>
        {vehiculos.length} unidades con el ciclo terminado.
      </p>
      {error && <p style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)', marginBottom: 12 }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff' }}>
        <thead>
          <tr style={{ background: '#faf9f6' }}>
            {['Unidad', 'Fecha de venta', 'Canal', 'Precio final', 'Comisionista', 'Comisión', 'Fecha de pago',
              veFinanciero ? 'Utilidad' : null, veFinanciero ? 'Margen' : null, veFinanciero ? 'ROI' : null, veFinanciero ? '' : null]
              .filter((h) => h !== null).map((h, i) => <th key={i} style={th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {vehiculos.map((v) => {
            const venta = ventas.find((ve) => ve.vehiculo_id === v.id)
            const cierre = venta ? cierres.find((c) => c.venta_id === venta.id) : null
            const comision = venta ? comisiones.find((c) => c.venta_id === venta.id) : null
            const ocupado = venta ? guardandoId === venta.id : false
            return (
              <tr key={v.id} style={{ borderTop: '1px solid #f0ede6', opacity: ocupado ? 0.5 : 1 }}>
                <td style={td}>
                  <Link to={`/vehiculo/${v.id}`} style={{ color: '#1c1b19' }}>{v.marca} {v.modelo} {v.anio} <span style={{ color: '#8b8578' }}>· {v.id_interno}</span></Link>
                </td>
                <td style={td}>
                  {venta && puedeEditarVenta ? (
                    <input
                      type="date" defaultValue={venta.fecha_venta}
                      onBlur={(e) => { if (e.target.value !== venta.fecha_venta) actualizarVenta(venta.id, { fecha_venta: e.target.value }) }}
                      style={{ ...inputStyle, width: 130 }}
                    />
                  ) : (venta?.fecha_venta ?? '—')}
                </td>
                <td style={td}>
                  {venta && puedeEditarVenta ? (
                    <select
                      defaultValue={venta.canal}
                      onChange={(e) => actualizarVenta(venta.id, { canal: e.target.value })}
                      style={selectStyle}
                    >
                      {CANALES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (venta?.canal ?? '—')}
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {venta && puedeEditarVenta ? (
                    <input
                      type="number" step="0.01" defaultValue={venta.precio_acordado}
                      onBlur={(e) => {
                        const val = Number(e.target.value)
                        if (val !== venta.precio_acordado) actualizarVenta(venta.id, { precio_acordado: val })
                      }}
                      style={{ ...inputStyle, width: 110, textAlign: 'right' }}
                    />
                  ) : mxn(venta?.precio_acordado ?? null)}
                </td>
                <td style={td}>{venta?.comisionista?.nombre ?? '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {comision && puedeEditarComision ? (
                    <input
                      type="number" step="0.01" defaultValue={comision.monto_autorizado ?? comision.monto_estimado ?? ''}
                      onBlur={(e) => {
                        const val = e.target.value ? Number(e.target.value) : null
                        if (val !== comision.monto_autorizado) actualizarComision(comision.id, { monto_autorizado: val })
                      }}
                      style={{ ...inputStyle, width: 100, textAlign: 'right' }}
                    />
                  ) : (
                    mxn(comision?.monto_pagado ?? comision?.monto_autorizado ?? comision?.monto_estimado ?? null)
                  )}
                </td>
                <td style={td}>
                  {comision && puedeEditarComision ? (
                    <input
                      type="date" defaultValue={comision.fecha_pago ?? ''}
                      onBlur={(e) => {
                        const val = e.target.value || null
                        if (val === comision.fecha_pago) return
                        const cambios: Record<string, unknown> = { fecha_pago: val }
                        if (val && comision.monto_pagado === null) cambios.monto_pagado = comision.monto_autorizado ?? comision.monto_estimado
                        actualizarComision(comision.id, cambios)
                      }}
                      style={{ ...inputStyle, width: 130 }}
                    />
                  ) : (comision?.fecha_pago ?? '—')}
                </td>
                {veFinanciero && <td style={{ ...td, textAlign: 'right' }}>{cierre ? mxn(cierre.utilidad_bruta) : '—'}</td>}
                {veFinanciero && <td style={{ ...td, textAlign: 'right' }}>{cierre ? porcentaje(cierre.margen) : '—'}</td>}
                {veFinanciero && <td style={{ ...td, textAlign: 'right' }}>{cierre ? porcentaje(cierre.roi) : '—'}</td>}
                {veFinanciero && (
                  <td style={{ ...td, textAlign: 'right' }}>
                    {venta && cierre && (
                      <button onClick={() => setReabriendo({ venta, cierre })} style={{ ...btnSecundario, padding: '5px 10px', fontSize: 11 }}>
                        Recalcular cierre
                      </button>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
          {vehiculos.length === 0 && (
            <tr><td colSpan={veFinanciero ? 11 : 7} style={{ padding: 20, textAlign: 'center', color: '#8b8578' }}>Sin unidades vendidas todavía.</td></tr>
          )}
        </tbody>
      </table>

      {reabriendo && (
        <RecalcularCierreModal
          venta={reabriendo.venta}
          cierre={reabriendo.cierre}
          onClose={() => setReabriendo(null)}
          onConfirmar={async (motivo) => {
            const err = await recalcularCierre(reabriendo.venta, reabriendo.cierre, motivo)
            if (!err) { setReabriendo(null); recargar() }
            return err
          }}
        />
      )}
    </div>
  )
}

function RecalcularCierreModal({ venta, cierre, onClose, onConfirmar }: {
  venta: VentaConComisionista
  cierre: CierreFinanciero
  onClose: () => void
  onConfirmar: (motivo: string) => Promise<string | null>
}) {
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:recalcular-cierre:${cierre.id}`, { motivo: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    const err = await onConfirmar(form.motivo)
    setGuardando(false)
    if (err) { setError(err); return }
    limpiarBorrador()
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0, font: '500 16px Georgia, serif' }}>Recalcular cierre financiero</h3>
        <p style={{ margin: 0, fontSize: 12, color: '#8b8578' }}>
          Utilidad actual: {mxn(cierre.utilidad_bruta)} · precio de venta actual: {mxn(venta.precio_acordado)}.
          Esto borra el cierre anterior y genera uno nuevo con el precio/canal corregidos — queda un registro
          de por qué se reabrió.
        </p>
        <textarea
          required placeholder="Motivo de la corrección"
          value={form.motivo} onChange={(e) => setForm({ motivo: e.target.value })}
          rows={2}
          style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
        />
        {error && <div style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)' }}>{error}</div>}
        <FormBotones onClose={onClose} guardando={guardando} textoGuardar="Recalcular" />
      </form>
    </Modal>
  )
}
