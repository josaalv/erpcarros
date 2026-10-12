import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { mxn, fecha, etiqueta, CANAL_LABEL, FORMA_PAGO_LABEL, ESTADO_VENTA } from '../lib/helpers'
import { PageHeader, Alerta, Cargando, EtiquetaBadge, NombreUnidad, Modal } from '../components/Ui'
import type { Venta, Socio } from '../types'

/** Fila de liquidacion_de_venta (migración 028): lo que le toca a cada socio. */
interface FilaReparto { socio_id: number; capital: number; participacion: number; utilidad: number; monto: number }

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
  const [saldos, setSaldos] = useState<Record<number, number>>({})
  const [cerrando, setCerrando] = useState<VentaConVehiculo | null>(null)

  const esAdmin = perfil?.rol === 'admin'

  async function recargar() {
    if (!supabase) return
    const ve = await supabase.from('venta')
      .select('*, vehiculo:vehiculo_id(id, id_interno, marca, modelo, anio, fecha_compra), cliente:cliente_id(nombre), comisionista:comisionista_id(nombre)')
      .eq('estado', 'en_proceso')
      .order('fecha_venta', { ascending: false })
    const lista = (ve.data ?? []) as unknown as VentaConVehiculo[]
    setVentas(lista)
    if (lista.length) {
      const { data: sal } = await supabase.from('v_saldo_venta').select('venta_id, saldo').in('venta_id', lista.map((v) => v.id))
      setSaldos(Object.fromEntries(((sal ?? []) as { venta_id: number; saldo: number }[]).map((x) => [x.venta_id, x.saldo])))
    }
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  async function cerrarFinanciero(venta: VentaConVehiculo) {
    if (!supabase) return
    setCerrando(null)
    setError(null)
    setAviso(null)
    setOcupado(venta.id)
    // Todo el cierre (cierre, liquidación por socio, comisión, estados) es una
    // sola transacción en la base: o se guarda completo o no se guarda nada.
    const { data, error: err } = await supabase.rpc('cerrar_financiero', { p_venta_id: venta.id })
    setOcupado(null)
    if (err) { setError(err.message); recargar(); return }
    setAviso(`Venta cerrada. Utilidad: ${mxn((data as { utilidad: number }).utilidad)}. Se abonó lo de cada socio a su cuenta del fondo y la unidad ya aparece en Vendidos.`)
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
        descripcion="Ventas registradas que todavía no tienen cierre financiero. Se cierran cuando se cobra el total (Por cobrar); al cerrar, a cada socio se le abona lo suyo en el fondo."
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
              <th className="num">Falta cobrar</th>
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
                <td className={`num ${(saldos[v.id] ?? 0) > 0.009 ? 'texto-aviso' : ''}`}>{(saldos[v.id] ?? 0) > 0.009 ? mxn(saldos[v.id]) : 'Cobrada'}</td>
                <td><EtiquetaBadge etiqueta={etiqueta(ESTADO_VENTA, v.estado)} /></td>
                {esAdmin && (
                  <td className="acciones-celda">
                    <button className="btn-link peligro" onClick={() => cancelarVenta(v)} disabled={ocupado !== null}>Cancelar</button>{' '}
                    <button className="btn btn-primario btn-chico" onClick={() => setCerrando(v)} disabled={ocupado !== null}>
                      {ocupado === v.id ? 'Procesando…' : 'Cerrar venta'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {ventas.length === 0 && <tr><td colSpan={8} className="vacio">No hay ventas pendientes de cerrar.</td></tr>}
          </tbody>
        </table>
      </div>
      {cerrando && (
        <CierreModal venta={cerrando} saldo={saldos[cerrando.id] ?? 0} onConfirmar={() => cerrarFinanciero(cerrando)} onClose={() => setCerrando(null)} />
      )}
      {!esAdmin && ventas.length > 0 && (
        <p className="texto-muted" style={{ marginTop: 12 }}>Solo el administrador puede cerrar o cancelar una venta.</p>
      )}
    </div>
  )
}

/**
 * Vista previa del cierre: cuánto le toca a cada socio según la modalidad de
 * la unidad (misma función que usa el cierre en la base) y qué préstamos se
 * pagan. Si falta cobrar o falta información, lo dice y no deja cerrar.
 */
function CierreModal({ venta, saldo, onConfirmar, onClose }: {
  venta: VentaConVehiculo
  saldo: number
  onConfirmar: () => void
  onClose: () => void
}) {
  const [reparto, setReparto] = useState<FilaReparto[] | null>(null)
  const [socios, setSocios] = useState<Socio[]>([])
  const [prestamos, setPrestamos] = useState<{ prestamista_id: number; deudor_id: number; monto: number }[]>([])
  const [problema, setProblema] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    Promise.all([
      supabase.rpc('liquidacion_de_venta', { p_venta_id: venta.id }),
      supabase.from('socio').select('id, nombre'),
      supabase.from('prestamo_socio').select('prestamista_id, deudor_id, monto').eq('vehiculo_id', venta.vehiculo_id).eq('pagado', false),
    ]).then(([r, s, p]) => {
      if (r.error) setProblema(r.error.message)
      setReparto((r.data ?? []) as FilaReparto[])
      setSocios((s.data ?? []) as Socio[])
      setPrestamos((p.data ?? []) as { prestamista_id: number; deudor_id: number; monto: number }[])
    })
  }, [venta.id, venta.vehiculo_id])

  const nombre = (id: number) => socios.find((x) => x.id === id)?.nombre ?? '—'
  const faltaCobrar = saldo > 0.009
  const titulo = venta.vehiculo ? `${venta.vehiculo.marca} ${venta.vehiculo.modelo} ${venta.vehiculo.anio}` : 'la unidad'

  return (
    <Modal titulo={`Cerrar venta · ${titulo}`} subtitulo={`Precio de venta ${mxn(venta.precio_acordado)}. Lo de cada socio se abona a su cuenta y queda en el fondo (sacarlo es un retiro).`} ancho={720} onClose={onClose}>
      <div className="form">
        {faltaCobrar && <Alerta tipo="aviso">Falta cobrar <strong>{mxn(saldo)}</strong>. La venta se cierra cuando se recibe el pago completo: regístralo en Por cobrar.</Alerta>}
        {problema && <Alerta>{problema}</Alerta>}
        {reparto === null ? <Cargando /> : !problema && (
          <div className="tabla-wrap">
            <table className="tabla">
              <thead><tr><th>Socio</th><th className="num">Capital</th><th className="num">Participación</th><th className="num">Utilidad</th><th className="num">Se le abona</th></tr></thead>
              <tbody>
                {reparto.map((f) => (
                  <tr key={f.socio_id}>
                    <td style={{ fontWeight: 600 }}>{nombre(f.socio_id)}</td>
                    <td className="num">{mxn(f.capital)}</td>
                    <td className="num">{(f.participacion * 100).toFixed(2)}%</td>
                    <td className={`num ${f.utilidad < 0 ? 'texto-peligro' : ''}`}>{mxn(f.utilidad)}</td>
                    <td className="num"><strong>{mxn(f.monto)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {prestamos.length > 0 && (
          <p className="texto-suave" style={{ margin: 0 }}>
            Se pagan con esta venta: {prestamos.map((p) => `${nombre(p.deudor_id)} le regresa ${mxn(p.monto)} a ${nombre(p.prestamista_id)}`).join(' · ')}.
          </p>
        )}
        <div className="form-acciones">
          <button type="button" className="btn btn-secundario" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primario" disabled={faltaCobrar || Boolean(problema) || reparto === null} onClick={onConfirmar}>Cerrar venta</button>
        </div>
      </div>
    </Modal>
  )
}
