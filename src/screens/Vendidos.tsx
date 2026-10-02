import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useBorrador } from '../lib/useBorrador'
import { mxn, porcentaje, fecha, diasEntre, numeroONull, CANALES, CANAL_LABEL } from '../lib/helpers'
import { Modal, FormBotones, PageHeader, Alerta, Cargando, NombreUnidad, Badge, Kpi } from '../components/Ui'
import type { VehiculoFicha, Venta, CierreFinanciero, Comision } from '../types'

type VentaConComisionista = Venta & { comisionista?: { nombre: string } | null }

/**
 * Etapa final. Venta (admin/gerencia) y comisión (admin) se corrigen aquí.
 * "Recalcular cierre" actualiza el cierre existente en vez de borrarlo: el
 * FK reapertura→cierre_financiero es ON DELETE CASCADE, así que borrarlo
 * borraría también el motivo que se acaba de registrar.
 */
export default function Vendidos() {
  const { perfil, session } = useAuth()
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [ventas, setVentas] = useState<VentaConComisionista[]>([])
  const [cierres, setCierres] = useState<CierreFinanciero[]>([])
  const [comisiones, setComisiones] = useState<Comision[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState<number | null>(null)
  const [reabriendo, setReabriendo] = useState<{ v: VehiculoFicha; venta: VentaConComisionista; cierre: CierreFinanciero } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

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

  async function guardar(id: number, tabla: 'venta' | 'comision', cambios: Record<string, unknown>) {
    if (!supabase) return
    setGuardandoId(id)
    setError(null)
    setAviso(null)
    const { error: err } = await supabase.from(tabla).update(cambios).eq('id', id)
    if (err) setError(err.message)
    else if (tabla === 'venta' && veFinanciero) setAviso('Venta actualizada. Si cambiaste precio, canal o fecha, usa "Recalcular" para actualizar la utilidad.')
    await recargar()
    setGuardandoId(null)
  }

  async function recalcularCierre(v: VehiculoFicha, venta: VentaConComisionista, cierre: CierreFinanciero, motivo: string) {
    if (!supabase || !session) return 'Supabase no está configurado.'

    const [costoRes, aportRes] = await Promise.all([
      supabase.from('v_costo_vehiculo').select('costo_total').eq('vehiculo_id', venta.vehiculo_id).maybeSingle(),
      supabase.from('v_participacion_socio').select('*').eq('vehiculo_id', venta.vehiculo_id),
    ])
    if (costoRes.error || aportRes.error) return (costoRes.error ?? aportRes.error)!.message

    const costoTotal = (costoRes.data as { costo_total: number } | null)?.costo_total ?? 0
    const precioFinal = venta.precio_acordado
    const utilidadBruta = precioFinal - costoTotal

    const { error: errReapertura } = await supabase.from('reapertura').insert({ cierre_id: cierre.id, motivo, usuario_id: session.user.id })
    if (errReapertura) return errReapertura.message

    const { error: errLiqBorrar } = await supabase.from('liquidacion').delete().eq('cierre_id', cierre.id)
    if (errLiqBorrar) return errLiqBorrar.message

    const { error: errCierre } = await supabase.from('cierre_financiero').update({
      costo_total: costoTotal,
      precio_final: precioFinal,
      utilidad_bruta: utilidadBruta,
      margen: precioFinal > 0 ? utilidadBruta / precioFinal : 0,
      roi: costoTotal > 0 ? utilidadBruta / costoTotal : 0,
      dias_inventario: diasEntre(v.fecha_compra, venta.fecha_venta),
      canal_venta: venta.canal,
      estado: 'reabierto',
      cerrado_por: session.user.id,
    }).eq('id', cierre.id)
    if (errCierre) return errCierre.message

    const participaciones = (aportRes.data ?? []) as { socio_id: number; capital_aportado: number; participacion: number }[]
    if (participaciones.length > 0) {
      const { error: errLiq } = await supabase.from('liquidacion').insert(participaciones.map((p) => ({
        cierre_id: cierre.id,
        vehiculo_id: venta.vehiculo_id,
        socio_id: p.socio_id,
        capital_aportado: p.capital_aportado,
        participacion: p.participacion,
        utilidad_asignada: p.participacion * utilidadBruta,
        monto_a_pagar: p.capital_aportado + p.participacion * utilidadBruta,
      })))
      if (errLiq) return `El cierre se actualizó, pero falló la liquidación de socios: ${errLiq.message}. Vuelve a recalcular.`
    }
    return null
  }

  if (cargando) return <Cargando />

  const ventaDe = (vid: number) => ventas.find((ve) => ve.vehiculo_id === vid)
  const totalVendido = vehiculos.reduce((acc, v) => acc + (ventaDe(v.id)?.precio_acordado ?? 0), 0)
  const cierresDe = vehiculos.map((v) => { const ve = ventaDe(v.id); return ve ? cierres.find((c) => c.venta_id === ve.id) : undefined }).filter(Boolean) as CierreFinanciero[]
  const utilidadTotal = cierresDe.reduce((acc, c) => acc + c.utilidad_bruta, 0)

  return (
    <div>
      <PageHeader titulo="Vendidos" descripcion="Unidades con el ciclo terminado. Puedes corregir fecha, canal, precio y comisión directamente en la tabla." />

      <div className="kpis">
        <Kpi label="Unidades vendidas" valor={String(vehiculos.length)} />
        <Kpi label="Total vendido" valor={mxn(totalVendido)} />
        {veFinanciero && <Kpi label="Utilidad total" valor={mxn(utilidadTotal)} />}
      </div>

      {error && <div style={{ marginBottom: 16 }}><Alerta>{error}</Alerta></div>}
      {aviso && <div style={{ marginBottom: 16 }}><Alerta tipo="info">{aviso}</Alerta></div>}

      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              <th>Unidad</th>
              <th>Venta</th>
              <th className="num">Precio final</th>
              <th>Comisión</th>
              {veFinanciero && <th className="num">Utilidad</th>}
            </tr>
          </thead>
          <tbody>
            {vehiculos.map((v) => {
              const venta = ventaDe(v.id)
              const cierre = venta ? cierres.find((c) => c.venta_id === venta.id) : undefined
              const comision = venta ? comisiones.find((c) => c.venta_id === venta.id) : undefined
              const ocupado = guardandoId !== null && (guardandoId === venta?.id || guardandoId === comision?.id)
              return (
                <tr key={v.id} className={ocupado ? 'ocupado' : ''}>
                  <td><NombreUnidad v={v} /></td>
                  <td>
                    {venta && puedeEditarVenta ? (
                      <div style={{ display: 'grid', gap: 6 }}>
                        <input key={`f-${venta.id}-${venta.fecha_venta}`} className="input input-chico" type="date" defaultValue={venta.fecha_venta}
                          onBlur={(e) => { if (e.target.value && e.target.value !== venta.fecha_venta) guardar(venta.id, 'venta', { fecha_venta: e.target.value }) }} />
                        <select key={`c-${venta.id}-${venta.canal}`} className="select select-chico" defaultValue={venta.canal}
                          onChange={(e) => guardar(venta.id, 'venta', { canal: e.target.value })}>
                          {CANALES.map((c) => <option key={c} value={c}>{CANAL_LABEL[c]}</option>)}
                        </select>
                      </div>
                    ) : venta ? <>{fecha(venta.fecha_venta)}<span className="unidad-folio">{CANAL_LABEL[venta.canal]}</span></> : '—'}
                  </td>
                  <td className="num">
                    {venta && puedeEditarVenta ? (
                      <input key={`p-${venta.id}-${venta.precio_acordado}`} className="input input-chico input-num" type="number" step="0.01" min={0}
                        defaultValue={venta.precio_acordado} style={{ width: 130 }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                        onBlur={(e) => {
                          const val = Number(e.target.value)
                          if (e.target.value && val !== venta.precio_acordado) guardar(venta.id, 'venta', { precio_acordado: val })
                        }} />
                    ) : mxn(venta?.precio_acordado)}
                  </td>
                  <td>
                    {!comision ? <span className="texto-muted">{venta?.comisionista?.nombre ?? 'Sin comisionista'}</span> : (
                      <>
                        <span style={{ display: 'block', fontWeight: 500 }}>{venta?.comisionista?.nombre ?? 'Comisionista'}</span>
                        {puedeEditarComision ? (
                          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                            <input key={`m-${comision.id}-${comision.monto_autorizado}`} className="input input-chico input-num" type="number" step="0.01" min={0}
                              placeholder="Monto" title="Monto de la comisión" style={{ width: 110 }}
                              defaultValue={comision.monto_autorizado ?? comision.monto_estimado ?? ''}
                              onBlur={(e) => {
                                const val = numeroONull(e.target.value)
                                if (val !== comision.monto_autorizado) guardar(comision.id, 'comision', { monto_autorizado: val })
                              }} />
                            <input key={`d-${comision.id}-${comision.fecha_pago}`} className="input input-chico" type="date" title="Fecha en que se pagó"
                              defaultValue={comision.fecha_pago ?? ''}
                              onBlur={(e) => {
                                const val = e.target.value || null
                                if (val === comision.fecha_pago) return
                                const cambios: Record<string, unknown> = { fecha_pago: val }
                                if (val && comision.monto_pagado === null) cambios.monto_pagado = comision.monto_autorizado ?? comision.monto_estimado
                                if (!val) cambios.monto_pagado = null
                                guardar(comision.id, 'comision', cambios)
                              }} />
                          </div>
                        ) : <span className="unidad-folio">{mxn(comision.monto_pagado ?? comision.monto_autorizado ?? comision.monto_estimado)}</span>}
                        <div style={{ marginTop: 4 }}>{comision.fecha_pago ? <Badge tono="ok">Pagada</Badge> : <Badge tono="aviso">Pago pendiente</Badge>}</div>
                      </>
                    )}
                  </td>
                  {veFinanciero && (
                    <td className="num">
                      {cierre ? (
                        <>
                          <span style={{ fontWeight: 700, color: cierre.utilidad_bruta < 0 ? 'var(--danger)' : undefined }}>{mxn(cierre.utilidad_bruta)}</span>
                          <span className="unidad-folio">Margen {porcentaje(cierre.margen)} · ROI {porcentaje(cierre.roi)}</span>
                          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                            {cierre.estado === 'reabierto' && <Badge tono="info">Recalculado</Badge>}
                            {venta && <button className="btn-link" onClick={() => setReabriendo({ v, venta, cierre })}>Recalcular</button>}
                          </span>
                        </>
                      ) : '—'}
                    </td>
                  )}
                </tr>
              )
            })}
            {vehiculos.length === 0 && <tr><td colSpan={5} className="vacio">Todavía no hay unidades vendidas.</td></tr>}
          </tbody>
        </table>
      </div>

      {reabriendo && (
        <RecalcularCierreModal
          venta={reabriendo.venta}
          cierre={reabriendo.cierre}
          onClose={() => setReabriendo(null)}
          onConfirmar={async (motivo) => {
            const err = await recalcularCierre(reabriendo.v, reabriendo.venta, reabriendo.cierre, motivo)
            if (!err) { setReabriendo(null); setAviso('Cierre recalculado y liquidación de socios actualizada.'); recargar() }
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
    const err = await onConfirmar(form.motivo.trim())
    setGuardando(false)
    if (err) { setError(err); return }
    limpiarBorrador()
  }

  return (
    <Modal
      titulo="Recalcular cierre"
      subtitulo={`Utilidad registrada: ${mxn(cierre.utilidad_bruta)} con precio de ${mxn(cierre.precio_final)}. Se recalcula con el precio actual (${mxn(venta.precio_acordado)}), los costos actuales y se rehace el reparto a socios.`}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="form">
        <label className="campo">
          Motivo de la corrección
          <textarea className="textarea" required rows={3} value={form.motivo} onChange={(e) => setForm({ motivo: e.target.value })} autoFocus />
        </label>
        {error && <Alerta>{error}</Alerta>}
        <FormBotones onClose={onClose} guardando={guardando} textoGuardar="Recalcular" />
      </form>
    </Modal>
  )
}
