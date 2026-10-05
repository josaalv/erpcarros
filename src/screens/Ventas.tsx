import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { mxn, fecha, etiqueta, CANAL_LABEL, FORMA_PAGO_LABEL, ESTADO_VENTA } from '../lib/helpers'
import { PageHeader, Alerta, Cargando, EtiquetaBadge, NombreUnidad } from '../components/Ui'
import type { Venta } from '../types'

type VentaConVehiculo = Venta & {
  vehiculo?: { id: number; id_interno: string; marca: string; modelo: string; anio: number; fecha_compra: string | null } | null
  cliente?: { nombre: string } | null
  comisionista?: { nombre: string } | null
}

/**
 * Ventas registradas que aún no se cierran. Registrar venta vive en En venta;
 * al cerrar el financiero la unidad pasa a Vendidos. El cálculo vive en la
 * función cerrar_financiero (migración 019).
 */
export default function Ventas() {
  const { perfil } = useAuth()
  const [ventas, setVentas] = useState<VentaConVehiculo[]>([])
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const esAdmin = perfil?.rol === 'admin'

  async function recargar() {
    if (!supabase) return
    const ve = await supabase.from('venta')
      .select('*, vehiculo:vehiculo_id(id, id_interno, marca, modelo, anio, fecha_compra), cliente:cliente_id(nombre), comisionista:comisionista_id(nombre)')
      .eq('estado', 'en_proceso')
      .order('fecha_venta', { ascending: false })
    setVentas((ve.data ?? []) as unknown as VentaConVehiculo[])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  async function cerrarFinanciero(venta: VentaConVehiculo) {
    if (!supabase) return
    const nombre = venta.vehiculo ? `${venta.vehiculo.marca} ${venta.vehiculo.modelo} (${venta.vehiculo.id_interno})` : 'la unidad'
    if (!window.confirm(`¿Cerrar la venta de ${nombre} por ${mxn(venta.precio_acordado)}? Se calcula la utilidad, se reparte entre socios y la unidad pasa a Vendidos.`)) return
    setError(null)
    setAviso(null)
    setOcupado(venta.id)
    // Todo el cierre (cierre, liquidación por socio, comisión, estados) es una
    // sola transacción en la base: o se guarda completo o no se guarda nada.
    const { data, error: err } = await supabase.rpc('cerrar_financiero', { p_venta_id: venta.id })
    setOcupado(null)
    if (err) { setError(err.message); recargar(); return }
    setAviso(`Venta cerrada. Utilidad: ${mxn((data as { utilidad: number }).utilidad)}. La unidad ya aparece en Vendidos.`)
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
