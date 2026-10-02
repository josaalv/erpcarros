import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { mxn, fecha, diasEntre, etiqueta, CANAL_LABEL, FORMA_PAGO_LABEL, ESTADO_VENTA } from '../lib/helpers'
import { PageHeader, Alerta, Cargando, EtiquetaBadge, NombreUnidad } from '../components/Ui'
import type { Venta, Comision } from '../types'

type VentaConVehiculo = Venta & {
  vehiculo?: { id: number; id_interno: string; marca: string; modelo: string; anio: number; fecha_compra: string | null } | null
  cliente?: { nombre: string } | null
  comisionista?: { nombre: string } | null
}

/**
 * Ventas registradas que aún no se cierran. Registrar venta vive en En venta;
 * al cerrar el financiero la unidad pasa a Vendidos. El cierre se calcula en
 * el cliente (no hay RPC todavía): si dos admins cierran la misma venta a la
 * vez podría duplicarse — moverlo a una función security definer si pasa.
 */
export default function Ventas() {
  const { perfil, session } = useAuth()
  const [ventas, setVentas] = useState<VentaConVehiculo[]>([])
  const [comisiones, setComisiones] = useState<Comision[]>([])
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const esAdmin = perfil?.rol === 'admin'

  async function recargar() {
    if (!supabase) return
    const [ve, co] = await Promise.all([
      supabase.from('venta')
        .select('*, vehiculo:vehiculo_id(id, id_interno, marca, modelo, anio, fecha_compra), cliente:cliente_id(nombre), comisionista:comisionista_id(nombre)')
        .eq('estado', 'en_proceso')
        .order('fecha_venta', { ascending: false }),
      supabase.from('comision').select('*'),
    ])
    setVentas((ve.data ?? []) as unknown as VentaConVehiculo[])
    setComisiones((co.data ?? []) as Comision[])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  async function cerrarFinanciero(venta: VentaConVehiculo) {
    if (!supabase || !session) return
    const nombre = venta.vehiculo ? `${venta.vehiculo.marca} ${venta.vehiculo.modelo} (${venta.vehiculo.id_interno})` : 'la unidad'
    if (!window.confirm(`¿Cerrar la venta de ${nombre} por ${mxn(venta.precio_acordado)}? Se calcula la utilidad, se reparte entre socios y la unidad pasa a Vendidos.`)) return
    setError(null)
    setAviso(null)
    setOcupado(venta.id)

    const [costoRes, aportRes, cierrePrevio] = await Promise.all([
      supabase.from('v_costo_vehiculo').select('costo_total').eq('vehiculo_id', venta.vehiculo_id).maybeSingle(),
      supabase.from('v_participacion_socio').select('*').eq('vehiculo_id', venta.vehiculo_id),
      supabase.from('cierre_financiero').select('id').eq('venta_id', venta.id).maybeSingle(),
    ])

    const fallar = (msg: string) => { setOcupado(null); setError(msg); recargar() }

    if (costoRes.error || aportRes.error) return fallar(`No se pudieron leer los costos: ${(costoRes.error ?? aportRes.error)!.message}`)
    if (cierrePrevio.data) return fallar('Esta venta ya tiene un cierre financiero. Recarga la página.')

    const costoTotal = (costoRes.data as { costo_total: number } | null)?.costo_total ?? 0
    const precioFinal = venta.precio_acordado
    const utilidadBruta = precioFinal - costoTotal
    const margen = precioFinal > 0 ? utilidadBruta / precioFinal : 0
    const roi = costoTotal > 0 ? utilidadBruta / costoTotal : 0

    const { data: cierre, error: errCierre } = await supabase.from('cierre_financiero').insert({
      vehiculo_id: venta.vehiculo_id,
      venta_id: venta.id,
      costo_total: costoTotal,
      precio_final: precioFinal,
      utilidad_bruta: utilidadBruta,
      margen,
      roi,
      dias_inventario: diasEntre(venta.vehiculo?.fecha_compra, venta.fecha_venta),
      canal_venta: venta.canal,
      cerrado_por: session.user.id,
    }).select().single()
    if (errCierre || !cierre) return fallar(errCierre?.message ?? 'No se pudo cerrar.')

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
      if (errLiq) {
        // Sin liquidación el cierre queda incompleto: se deshace (cascada) para poder reintentar.
        await supabase.from('cierre_financiero').delete().eq('id', cierre.id)
        return fallar(`No se pudo generar la liquidación de socios: ${errLiq.message}`)
      }
    }

    if (venta.comisionista_id && !comisiones.some((c) => c.venta_id === venta.id)) {
      await supabase.from('comision').insert({ venta_id: venta.id, comisionista_id: venta.comisionista_id, esquema: 'fijo' })
    }

    const [errVenta, errVeh] = await Promise.all([
      supabase.from('venta').update({ estado: 'completada' }).eq('id', venta.id).then((r) => r.error),
      supabase.from('vehiculo').update({ estado_comercial: 'vendido' }).eq('id', venta.vehiculo_id).then((r) => r.error),
    ])
    if (errVenta || errVeh) return fallar(`El cierre se guardó, pero no se pudo actualizar el estado: ${(errVenta ?? errVeh)!.message}`)

    setOcupado(null)
    setAviso(`Venta cerrada. Utilidad: ${mxn(utilidadBruta)}. La unidad ya aparece en Vendidos.`)
    recargar()
  }

  async function cancelarVenta(venta: VentaConVehiculo) {
    if (!supabase) return
    if (!window.confirm('¿Cancelar esta venta? La unidad vuelve a estar disponible en En venta y se borra su comisión.')) return
    setError(null)
    setAviso(null)
    setOcupado(venta.id)
    const { error: errCom } = await supabase.from('comision').delete().eq('venta_id', venta.id)
    const { error: errVenta } = errCom ? { error: errCom } : await supabase.from('venta').update({ estado: 'cancelada' }).eq('id', venta.id)
    setOcupado(null)
    if (errVenta) { setError(errVenta.message); return }
    setAviso('Venta cancelada.')
    recargar()
  }

  if (cargando) return <Cargando />

  return (
    <div>
      <PageHeader
        titulo="Ventas por cerrar"
        descripcion="Ventas registradas que todavía no tienen cierre financiero. Para registrar una nueva, ve a En venta."
      />

      {error && <div style={{ marginBottom: 16 }}><Alerta>{error}</Alerta></div>}
      {aviso && <div style={{ marginBottom: 16 }}><Alerta tipo="ok">{aviso}</Alerta></div>}

      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              <th>Unidad</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Canal</th>
              <th className="num">Precio acordado</th>
              <th>Estado</th>
              {esAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.id} className={ocupado === v.id ? 'ocupado' : ''}>
                <td>{v.vehiculo ? <NombreUnidad v={v.vehiculo} /> : `#${v.vehiculo_id}`}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{fecha(v.fecha_venta)}</td>
                <td>{v.cliente?.nombre ?? <span className="texto-muted">—</span>}</td>
                <td>
                  {CANAL_LABEL[v.canal] ?? v.canal}
                  {v.comisionista && <span className="unidad-folio">{v.comisionista.nombre}</span>}
                </td>
                <td className="num">
                  {mxn(v.precio_acordado)}
                  <span className="unidad-folio">{FORMA_PAGO_LABEL[v.forma_pago] ?? v.forma_pago}</span>
                </td>
                <td><EtiquetaBadge etiqueta={etiqueta(ESTADO_VENTA, v.estado)} /></td>
                {esAdmin && (
                  <td className="acciones-celda">
                    <button className="btn-link peligro" onClick={() => cancelarVenta(v)} disabled={ocupado !== null}>Cancelar</button>{' '}
                    <button className="btn btn-primario btn-chico" onClick={() => cerrarFinanciero(v)} disabled={ocupado !== null}>
                      {ocupado === v.id ? 'Procesando…' : 'Cerrar venta'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {ventas.length === 0 && <tr><td colSpan={7} className="vacio">No hay ventas pendientes de cerrar.</td></tr>}
          </tbody>
        </table>
      </div>
      {!esAdmin && ventas.length > 0 && (
        <p className="texto-muted" style={{ marginTop: 12 }}>Solo el administrador puede cerrar o cancelar una venta.</p>
      )}
    </div>
  )
}
