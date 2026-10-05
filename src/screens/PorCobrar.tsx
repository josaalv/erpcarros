import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { mxn, fecha, hoyISO, numeroONull, CANAL_LABEL, FORMA_PAGO_LABEL, ORIGEN_COBRO_LABEL, legible } from '../lib/helpers'
import { PageHeader, Kpi, Cargando, Alerta, NombreUnidad, Modal, Campo, FormBotones, Badge } from '../components/Ui'
import type { SaldoVenta, Cobro, Venta } from '../types'

type VentaInfo = Pick<Venta, 'id' | 'vehiculo_id' | 'canal' | 'forma_pago' | 'fecha_venta' | 'estado'> & {
  vehiculo: { id: number; id_interno: string; marca: string; modelo: string; anio: number } | null
  cliente: { nombre: string; telefono: string | null } | null
}

/**
 * Ventas con dinero por entrar (v_saldo_venta.saldo > 0): lo que falta de la
 * financiera, del cliente, etc. Incluye ventas ya cerradas: el cierre calcula
 * la utilidad, pero el dinero puede seguir pendiente.
 */
export default function PorCobrar() {
  const { perfil } = useAuth()
  const [saldos, setSaldos] = useState<SaldoVenta[]>([])
  const [ventas, setVentas] = useState<VentaInfo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [abierta, setAbierta] = useState<{ saldo: SaldoVenta; venta: VentaInfo } | null>(null)
  const [verLiquidadas, setVerLiquidadas] = useState(false)

  async function recargar() {
    if (!supabase) return
    const [s, v] = await Promise.all([
      supabase.from('v_saldo_venta').select('*'),
      supabase.from('venta')
        .select('id, vehiculo_id, canal, forma_pago, fecha_venta, estado, vehiculo:vehiculo_id(id, id_interno, marca, modelo, anio), cliente:cliente_id(nombre, telefono)')
        .neq('estado', 'cancelada'),
    ])
    if (s.error) setError(s.error.message)
    setSaldos((s.data ?? []) as SaldoVenta[])
    setVentas((v.data ?? []) as unknown as VentaInfo[])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  if (cargando) return <Cargando />

  const hoy = hoyISO()
  const filas = saldos
    .filter((s) => (verLiquidadas ? true : s.saldo > 0.009))
    .map((s) => ({ saldo: s, venta: ventas.find((v) => v.id === s.venta_id) }))
    .filter((f): f is { saldo: SaldoVenta; venta: VentaInfo } => Boolean(f.venta))
    .sort((a, b) => (a.saldo.fecha_liquidacion_esperada ?? '9999').localeCompare(b.saldo.fecha_liquidacion_esperada ?? '9999'))
  const pendientes = saldos.filter((s) => s.saldo > 0.009)
  const total = pendientes.reduce((a, s) => a + s.saldo, 0)
  const vencidos = pendientes.filter((s) => s.fecha_liquidacion_esperada && s.fecha_liquidacion_esperada < hoy)

  return (
    <div>
      <PageHeader
        titulo="Por cobrar"
        descripcion="Ventas con dinero que todavía no entra: lo que falta de la financiera, del cliente o de otros. Registra cada pago al recibirlo."
      />
      {error && <Alerta>{error}</Alerta>}

      <div className="kpis">
        <Kpi label="Total por cobrar" valor={mxn(total)} nota={`${pendientes.length} ventas con saldo`} />
        <Kpi label="Vencido" valor={mxn(vencidos.reduce((a, s) => a + s.saldo, 0))} nota={`${vencidos.length} pasaron su fecha esperada`} />
      </div>

      <div className="filtros">
        <label className="check">
          <input type="checkbox" checked={verLiquidadas} onChange={(e) => setVerLiquidadas(e.target.checked)} />
          Mostrar también las ventas ya cobradas completas
        </label>
      </div>

      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              <th>Unidad</th><th>Venta</th><th className="num">Precio</th><th className="num">Cobrado</th>
              <th className="num">Saldo</th><th>Se espera</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ saldo: s, venta: v }) => {
              const vencido = s.saldo > 0.009 && s.fecha_liquidacion_esperada && s.fecha_liquidacion_esperada < hoy
              return (
                <tr key={s.venta_id}>
                  <td>{v.vehiculo ? <NombreUnidad v={v.vehiculo} /> : '—'}</td>
                  <td>
                    <span className="nowrap">{fecha(v.fecha_venta)}</span>
                    <span className="unidad-folio">
                      {FORMA_PAGO_LABEL[v.forma_pago] ?? legible(v.forma_pago)} · {CANAL_LABEL[v.canal] ?? legible(v.canal)}
                      {v.cliente ? ` · ${v.cliente.nombre}` : ''}
                    </span>
                  </td>
                  <td className="num">{mxn(s.precio_acordado)}</td>
                  <td className="num">
                    {mxn(s.cobrado + s.valor_toma)}
                    {s.valor_toma > 0 && <span className="unidad-folio">incluye toma {mxn(s.valor_toma)}</span>}
                  </td>
                  <td className="num"><strong>{mxn(s.saldo)}</strong></td>
                  <td>
                    {s.saldo <= 0.009 ? <Badge tono="ok">Cobrada</Badge>
                      : s.fecha_liquidacion_esperada ? <Badge tono={vencido ? 'peligro' : 'neutral'}>{fecha(s.fecha_liquidacion_esperada)}</Badge>
                      : <span className="texto-suave">Sin fecha</span>}
                  </td>
                  <td className="acciones-celda">
                    <button className="btn btn-secundario btn-chico" onClick={() => setAbierta({ saldo: s, venta: v })}>Cobros</button>
                  </td>
                </tr>
              )
            })}
            {filas.length === 0 && <tr><td colSpan={7} className="vacio">No hay dinero pendiente de cobrar.</td></tr>}
          </tbody>
        </table>
      </div>

      {abierta && (
        <CobrosModal
          saldo={abierta.saldo}
          venta={abierta.venta}
          puedeBorrar={perfil?.rol === 'admin' || perfil?.rol === 'gerencia'}
          onClose={() => setAbierta(null)}
          onCambio={async () => {
            await recargar()
            const { data } = await supabase!.from('v_saldo_venta').select('*').eq('venta_id', abierta.saldo.venta_id).maybeSingle()
            if (data) setAbierta((a) => (a ? { ...a, saldo: data as SaldoVenta } : a))
          }}
        />
      )}
    </div>
  )
}

/** Lista de cobros de una venta: registrar, corregir y quitar; y fecha esperada del resto. */
function CobrosModal({ saldo, venta, puedeBorrar, onClose, onCambio }: {
  saldo: SaldoVenta
  venta: VentaInfo
  puedeBorrar: boolean
  onClose: () => void
  onCambio: () => void
}) {
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [form, setForm] = useState({ fecha: hoyISO(), monto: '', origen: 'financiera', referencia: '' })
  const [fechaEsperada, setFechaEsperada] = useState(saldo.fecha_liquidacion_esperada ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    const { data } = await supabase!.from('cobro').select('*').eq('venta_id', saldo.venta_id).order('fecha')
    setCobros((data ?? []) as Cobro[])
  }
  useEffect(() => { cargar() }, [saldo.venta_id])  // eslint-disable-line react-hooks/exhaustive-deps

  async function agregar(e: FormEvent) {
    e.preventDefault()
    const monto = numeroONull(form.monto)
    if (!monto || monto <= 0) { setError('Escribe el monto recibido.'); return }
    setGuardando(true)
    setError(null)
    const { error: err } = await supabase!.from('cobro').insert({
      venta_id: saldo.venta_id, vehiculo_id: saldo.vehiculo_id, fecha: form.fecha, monto,
      origen: form.origen, referencia: form.referencia.trim() || null,
    })
    setGuardando(false)
    if (err) { setError(err.message); return }
    setForm((f) => ({ ...f, monto: '', referencia: '' }))
    await cargar()
    onCambio()
  }

  async function quitar(c: Cobro) {
    if (!window.confirm(`¿Quitar el cobro de ${mxn(c.monto)} del ${fecha(c.fecha)}?`)) return
    const { error: err } = await supabase!.from('cobro').delete().eq('id', c.id)
    if (err) { setError(err.message); return }
    await cargar()
    onCambio()
  }

  async function guardarFechaEsperada(valor: string) {
    setFechaEsperada(valor)
    const { error: err } = await supabase!.from('venta').update({ fecha_liquidacion_esperada: valor || null }).eq('id', saldo.venta_id)
    if (err) setError(err.message)
    else onCambio()
  }

  const nombre = venta.vehiculo ? `${venta.vehiculo.marca} ${venta.vehiculo.modelo} ${venta.vehiculo.anio} · ${venta.vehiculo.id_interno}` : ''

  return (
    <Modal titulo="Cobros de la venta" subtitulo={nombre} ancho={640} onClose={onClose}>
      <div className="datos" style={{ marginBottom: 16 }}>
        <div><div className="dato-label">Precio</div><div>{mxn(saldo.precio_acordado)}</div></div>
        <div><div className="dato-label">Cobrado</div><div>{mxn(saldo.cobrado + saldo.valor_toma)}</div></div>
        <div><div className="dato-label">Saldo</div><div><strong>{mxn(saldo.saldo)}</strong></div></div>
      </div>

      <div className="tabla-wrap" style={{ marginBottom: 16 }}>
        <table className="tabla">
          <thead><tr><th>Fecha</th><th>De</th><th>Referencia</th><th className="num">Monto</th><th></th></tr></thead>
          <tbody>
            {saldo.valor_toma > 0 && (
              <tr><td>{fecha(venta.fecha_venta)}</td><td>Toma a cuenta</td><td className="texto-suave">Unidad recibida</td><td className="num">{mxn(saldo.valor_toma)}</td><td></td></tr>
            )}
            {cobros.map((c) => (
              <tr key={c.id}>
                <td className="nowrap">{fecha(c.fecha)}</td>
                <td>{ORIGEN_COBRO_LABEL[c.origen] ?? legible(c.origen)}</td>
                <td className="texto-suave">{c.referencia ?? '—'}</td>
                <td className="num">{mxn(c.monto)}</td>
                <td className="acciones-celda">{puedeBorrar && <button className="btn-link peligro" onClick={() => quitar(c)}>Quitar</button>}</td>
              </tr>
            ))}
            {cobros.length === 0 && saldo.valor_toma <= 0 && <tr><td colSpan={5} className="vacio">Todavía no se ha registrado ningún pago.</td></tr>}
          </tbody>
        </table>
      </div>

      <form onSubmit={agregar} className="form">
        <div className="card-titulo">Registrar pago recibido</div>
        <div className="form-grid">
          <Campo label="Monto"><input className="input" type="number" step="0.01" min={0} value={form.monto} placeholder={saldo.saldo > 0 ? String(saldo.saldo) : ''} onChange={(e) => setForm({ ...form, monto: e.target.value })} /></Campo>
          <Campo label="Fecha"><input className="input" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></Campo>
          <Campo label="De">
            <select className="select" value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })}>
              {Object.entries(ORIGEN_COBRO_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Campo>
          <Campo label="Referencia" ayuda="Folio de transferencia, financiera, etc."><input className="input" value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} /></Campo>
        </div>
        {saldo.saldo > 0.009 && (
          <Campo label="¿Cuándo se espera el resto?">
            <input className="input" type="date" value={fechaEsperada} onChange={(e) => guardarFechaEsperada(e.target.value)} />
          </Campo>
        )}
        {error && <Alerta>{error}</Alerta>}
        <FormBotones onClose={onClose} guardando={guardando} textoGuardar="Registrar pago" />
      </form>
    </Modal>
  )
}
