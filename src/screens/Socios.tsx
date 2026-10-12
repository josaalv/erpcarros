import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useBorrador } from '../lib/useBorrador'
import { mxn, porcentaje, fecha, hoyISO } from '../lib/helpers'
import { retiroMaximo } from '../lib/fondo'
import { ORIGEN_LABEL } from '../lib/propiedad'
import { Modal, FormBotones, PageHeader, Campo, Alerta, Cargando, Kpi, Badge } from '../components/Ui'
import { AportacionCompraModal, EstadoCuentaModal, MovimientoModal, PrestamoModal, type UnidadOpcion } from '../components/Fondo'
import type { Socio, Aportacion, Liquidacion, CuentaSocio, MovimientoFondo, PrestamoSocio } from '../types'

type LiquidacionVista = Liquidacion & { vehiculo_id_interno?: string; socio_nombre?: string }
type Pestana = 'cuentas' | 'prestamos' | 'aportaciones' | 'liquidaciones'

/**
 * Solo admin. Fondo común: cada socio tiene su parte líquida (calculada de
 * sus movimientos en v_movimiento_socio), su capital invertido en unidades
 * sin vender y sus préstamos. El FK impide borrar un socio con historial;
 * para dejar de usarlo se desactiva.
 */
export default function Socios() {
  const [socios, setSocios] = useState<Socio[]>([])
  const [cuentas, setCuentas] = useState<CuentaSocio[]>([])
  const [aportaciones, setAportaciones] = useState<Aportacion[]>([])
  const [prestamos, setPrestamos] = useState<PrestamoSocio[]>([])
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionVista[]>([])
  const [unidades, setUnidades] = useState<UnidadOpcion[]>([])
  const [cargando, setCargando] = useState(true)
  const [pestana, setPestana] = useState<Pestana>('cuentas')
  const [socioModal, setSocioModal] = useState<Socio | 'nuevo' | null>(null)
  const [aportacionModal, setAportacionModal] = useState<Aportacion | 'nueva' | null>(null)
  const [movimientoModal, setMovimientoModal] = useState<{ movimiento: MovimientoFondo | null; socioId?: number } | null>(null)
  const [prestamoModal, setPrestamoModal] = useState<PrestamoSocio | 'nuevo' | null>(null)
  const [estadoCuenta, setEstadoCuenta] = useState<Socio | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function recargar() {
    if (!supabase) return
    const [s, c, a, p, l, v] = await Promise.all([
      supabase.from('socio').select('*').order('nombre'),
      supabase.from('v_cuenta_socio').select('*'),
      supabase.from('aportacion').select('*').order('fecha', { ascending: false }),
      supabase.from('prestamo_socio').select('*').order('pagado').order('fecha', { ascending: false }),
      supabase.from('liquidacion').select('*, vehiculo:vehiculo_id(id_interno), socio:socio_id(nombre)').order('pagado').order('id', { ascending: false }),
      supabase.from('v_vehiculo_ficha').select('id, id_interno, marca, modelo, anio, estado_comercial').order('id_interno'),
    ])
    setSocios((s.data ?? []) as Socio[])
    setCuentas((c.data ?? []) as CuentaSocio[])
    setAportaciones((a.data ?? []) as Aportacion[])
    setPrestamos((p.data ?? []) as PrestamoSocio[])
    setLiquidaciones(((l.data ?? []) as Record<string, unknown>[]).map((row) => ({
      ...(row as unknown as Liquidacion),
      vehiculo_id_interno: (row.vehiculo as { id_interno?: string } | null)?.id_interno,
      socio_nombre: (row.socio as { nombre?: string } | null)?.nombre,
    })))
    setUnidades((v.data ?? []) as UnidadOpcion[])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  async function ejecutar(promesa: PromiseLike<{ error: { message: string } | null }>, mensajeError?: string) {
    setError(null)
    const { error } = await promesa
    if (error) setError(mensajeError ?? error.message)
    recargar()
  }

  if (cargando) return <Cargando />

  const nombreSocio = (sid: number) => socios.find((s) => s.id === sid)?.nombre ?? '—'
  const unidad = (vid: number | null) => {
    const v = unidades.find((x) => x.id === vid)
    return v ? <>{v.marca} {v.modelo} {v.anio}<span className="unidad-folio">{v.id_interno}</span></> : <span className="texto-suave">—</span>
  }
  const cuentaDe = (sid: number) => cuentas.find((c) => c.socio_id === sid)
  const suma = (k: 'liquido' | 'invertido' | 'patrimonio') => cuentas.reduce((acc, c) => acc + c[k], 0)
  const pendientes = prestamos.filter((p) => !p.pagado)
  const pendientesPago = liquidaciones.filter((l) => !l.pagado)

  return (
    <div>
      <PageHeader
        titulo="Socios y fondo común"
        descripcion="La parte de cada socio en el fondo: lo líquido para ir a subastas, lo invertido en unidades sin vender y los préstamos entre socios."
        acciones={
          <>
            <button className="btn btn-secundario" onClick={() => setMovimientoModal({ movimiento: null })}>+ Movimiento del fondo</button>
            <button className="btn btn-primario" onClick={() => setSocioModal('nuevo')}>+ Nuevo socio</button>
          </>
        }
      />

      <div className="kpis">
        <Kpi label="Fondo líquido" valor={mxn(suma('liquido'))} nota="Disponible para ir a subastas" />
        <Kpi label="Invertido en unidades" valor={mxn(suma('invertido'))} nota="Capital en unidades que aún no se venden" />
        <Kpi label="Préstamos pendientes" valor={mxn(pendientes.reduce((acc, p) => acc + p.monto, 0))} nota={`${pendientes.length} entre socios`} />
        <Kpi label="Por pagar a socios" valor={mxn(pendientesPago.reduce((acc, l) => acc + l.monto_a_pagar, 0))} nota={`${pendientesPago.length} liquidaciones pendientes`} />
      </div>

      {error && <div style={{ marginBottom: 16 }}><Alerta>{error}</Alerta></div>}

      <div className="tabs">
        <button className={`tab${pestana === 'cuentas' ? ' activa' : ''}`} onClick={() => setPestana('cuentas')}>Cuentas ({socios.length})</button>
        <button className={`tab${pestana === 'prestamos' ? ' activa' : ''}`} onClick={() => setPestana('prestamos')}>Préstamos ({pendientes.length} pendientes)</button>
        <button className={`tab${pestana === 'aportaciones' ? ' activa' : ''}`} onClick={() => setPestana('aportaciones')}>Aportaciones a compras ({aportaciones.length})</button>
        <button className={`tab${pestana === 'liquidaciones' ? ' activa' : ''}`} onClick={() => setPestana('liquidaciones')}>Liquidaciones ({pendientesPago.length} por pagar)</button>
      </div>

      {pestana === 'cuentas' && (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th className="celda-nombre">Socio</th><th className="num">Líquido</th><th className="num">Invertido</th><th className="num">Debe</th>
                <th className="num">Le deben</th><th className="num">Patrimonio</th><th className="num">Pertenencia</th>
                <th className="num">Puede retirar</th><th>Activo</th><th></th>
              </tr>
            </thead>
            <tbody>
              {socios.map((s) => {
                const c = cuentaDe(s.id)
                return (
                  <tr key={s.id} className={s.activo ? '' : 'inactivo'}>
                    <td className="celda-nombre">{s.nombre}</td>
                    <td className={`num ${c && c.liquido < 0 ? 'texto-peligro' : ''}`}>{mxn(c?.liquido ?? 0)}</td>
                    <td className="num">{mxn(c?.invertido ?? 0)}</td>
                    <td className={`num ${c && c.debe > 0 ? 'texto-aviso' : ''}`}>{mxn(c?.debe ?? 0)}</td>
                    <td className="num">{mxn(c?.le_deben ?? 0)}</td>
                    <td className="num"><strong>{mxn(c?.patrimonio ?? 0)}</strong></td>
                    <td className="num">{c?.pertenencia != null ? porcentaje(c.pertenencia) : '—'}</td>
                    <td className="num">{c ? mxn(retiroMaximo(c, cuentas)) : '—'}</td>
                    <td>
                      <label className="check">
                        <input type="checkbox" checked={s.activo} onChange={(e) => ejecutar(supabase!.from('socio').update({ activo: e.target.checked }).eq('id', s.id))} />
                        {s.activo ? 'Sí' : 'No'}
                      </label>
                    </td>
                    <td className="acciones-celda acciones-columna">
                      <button className="btn-link" onClick={() => setEstadoCuenta(s)}>Estado de cuenta</button>
                      <button className="btn-link" onClick={() => setMovimientoModal({ movimiento: null, socioId: s.id })}>Movimiento</button>
                      <button className="btn-link" onClick={() => setSocioModal(s)}>Editar</button>
                      <button className="btn-link peligro" onClick={() => {
                        if (window.confirm(`¿Eliminar a ${s.nombre}?`)) {
                          ejecutar(supabase!.from('socio').delete().eq('id', s.id), `No se puede eliminar a ${s.nombre} porque ya tiene movimientos. Puedes desactivarlo.`)
                        }
                      }}>Eliminar</button>
                    </td>
                  </tr>
                )
              })}
              {socios.length === 0 && <tr><td colSpan={10} className="vacio">Todavía no hay socios.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {pestana === 'prestamos' && (
        <>
          <div className="seccion-header">
            <p className="texto-suave" style={{ margin: 0 }}>Sin interés. Se pagan al vender la unidad; quien presta no participa de la utilidad.</p>
            <button className="btn btn-primario" onClick={() => setPrestamoModal('nuevo')}>+ Registrar préstamo</button>
          </div>
          <div className="tabla-wrap">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Presta</th><th>Recibe</th><th>Unidad</th><th className="num">Monto</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {prestamos.map((p) => (
                  <tr key={p.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fecha(p.fecha)}</td>
                    <td style={{ fontWeight: 500 }}>{nombreSocio(p.prestamista_id)}</td>
                    <td style={{ fontWeight: 500 }}>{nombreSocio(p.deudor_id)}</td>
                    <td>{unidad(p.vehiculo_id)}{p.nota && <span className="unidad-folio">{p.nota}</span>}</td>
                    <td className="num">{mxn(p.monto)}</td>
                    <td>
                      <label className="check">
                        <input type="checkbox" checked={p.pagado}
                          onChange={(e) => ejecutar(supabase!.from('prestamo_socio').update({ pagado: e.target.checked, fecha_pago: e.target.checked ? hoyISO() : null }).eq('id', p.id))} />
                        {p.pagado ? <Badge tono="ok">Pagado {fecha(p.fecha_pago)}</Badge> : <Badge tono="aviso">Pendiente</Badge>}
                      </label>
                    </td>
                    <td className="acciones-celda">
                      <button className="btn-link" onClick={() => setPrestamoModal(p)}>Editar</button>
                      <button className="btn-link peligro" onClick={() => {
                        if (window.confirm(`¿Eliminar el préstamo de ${nombreSocio(p.prestamista_id)} a ${nombreSocio(p.deudor_id)} por ${mxn(p.monto)}?`)) {
                          ejecutar(supabase!.from('prestamo_socio').delete().eq('id', p.id))
                        }
                      }}>Eliminar</button>
                    </td>
                  </tr>
                ))}
                {prestamos.length === 0 && <tr><td colSpan={7} className="vacio">No hay préstamos entre socios.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pestana === 'aportaciones' && (
        <>
          <div className="seccion-header">
            <p className="texto-suave" style={{ margin: 0 }}>Lo que cada socio puso para comprar cada unidad. Si fue del fondo, se descuenta de su parte líquida.</p>
            <button className="btn btn-primario" onClick={() => setAportacionModal('nueva')}>+ Registrar aportación</button>
          </div>
          <div className="tabla-wrap">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Socio</th><th>Unidad</th><th>Con qué dinero</th><th className="num">Monto</th><th></th></tr></thead>
              <tbody>
                {aportaciones.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fecha(a.fecha)}</td>
                    <td style={{ fontWeight: 500 }}>{nombreSocio(a.socio_id)}</td>
                    <td>{unidad(a.vehiculo_id)}</td>
                    <td className="texto-suave">{ORIGEN_LABEL[a.origen]}</td>
                    <td className="num">{mxn(a.monto)}</td>
                    <td className="acciones-celda">
                      <button className="btn-link" onClick={() => setAportacionModal(a)}>Editar</button>
                      <button className="btn-link peligro" onClick={() => {
                        if (window.confirm(`¿Eliminar la aportación de ${nombreSocio(a.socio_id)} por ${mxn(a.monto)}?`)) {
                          ejecutar(supabase!.from('aportacion').delete().eq('id', a.id))
                        }
                      }}>Eliminar</button>
                    </td>
                  </tr>
                ))}
                {aportaciones.length === 0 && <tr><td colSpan={6} className="vacio">Todavía no hay aportaciones.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pestana === 'liquidaciones' && (
        <>
          <p className="texto-suave" style={{ marginTop: 0 }}>Se generan solas al cerrar una venta. Monto a pagar = capital aportado + su parte de la utilidad.</p>
          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr><th>Unidad</th><th>Socio</th><th className="num">Participación</th><th className="num">Utilidad</th><th className="num">A pagar</th><th>Pago</th></tr>
              </thead>
              <tbody>
                {liquidaciones.map((l) => (
                  <tr key={l.id}>
                    <td>{l.vehiculo_id_interno ?? '—'}</td>
                    <td style={{ fontWeight: 500 }}>{l.socio_nombre ?? '—'}</td>
                    <td className="num">{porcentaje(l.participacion)}</td>
                    <td className="num">{mxn(l.utilidad_asignada)}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{mxn(l.monto_a_pagar)}</td>
                    <td>
                      <label className="check">
                        <input type="checkbox" checked={l.pagado}
                          onChange={(e) => ejecutar(supabase!.from('liquidacion').update({ pagado: e.target.checked, fecha_pago: e.target.checked ? hoyISO() : null }).eq('id', l.id))} />
                        {l.pagado ? <Badge tono="ok">Pagado {fecha(l.fecha_pago)}</Badge> : <Badge tono="aviso">Pendiente</Badge>}
                      </label>
                    </td>
                  </tr>
                ))}
                {liquidaciones.length === 0 && <tr><td colSpan={6} className="vacio">Todavía no hay liquidaciones.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {socioModal && (
        <SocioModal
          socio={socioModal === 'nuevo' ? null : socioModal}
          onClose={() => setSocioModal(null)}
          onGuardado={() => { setSocioModal(null); recargar() }}
        />
      )}
      {aportacionModal && (
        <AportacionCompraModal
          aportacion={aportacionModal === 'nueva' ? null : aportacionModal}
          socios={socios}
          unidades={unidades}
          onClose={() => setAportacionModal(null)}
          onGuardado={() => { setAportacionModal(null); recargar() }}
        />
      )}
      {movimientoModal && (
        <MovimientoModal
          movimiento={movimientoModal.movimiento}
          socioId={movimientoModal.socioId}
          socios={socios}
          onClose={() => setMovimientoModal(null)}
          onGuardado={() => { setMovimientoModal(null); recargar() }}
        />
      )}
      {prestamoModal && (
        <PrestamoModal
          prestamo={prestamoModal === 'nuevo' ? null : prestamoModal}
          socios={socios}
          unidades={unidades}
          onClose={() => setPrestamoModal(null)}
          onGuardado={() => { setPrestamoModal(null); recargar() }}
        />
      )}
      {estadoCuenta && !movimientoModal && (
        <EstadoCuentaModal
          socio={estadoCuenta}
          unidades={unidades}
          onEditar={(m) => setMovimientoModal({ movimiento: m })}
          onClose={() => setEstadoCuenta(null)}
          onCambio={recargar}
        />
      )}
    </div>
  )
}

function SocioModal({ socio, onClose, onGuardado }: { socio: Socio | null; onClose: () => void; onGuardado: () => void }) {
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:socio:${socio?.id ?? 'nuevo'}`, {
    nombre: socio?.nombre ?? '', telefono: socio?.telefono ?? '', correo: socio?.correo ?? '',
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    const datos = { nombre: form.nombre.trim(), telefono: form.telefono.trim() || null, correo: form.correo.trim() || null }
    const { error } = socio
      ? await supabase.from('socio').update(datos).eq('id', socio.id)
      : await supabase.from('socio').insert(datos)
    setGuardando(false)
    if (error) { setError(error.message); return }
    limpiarBorrador()
    onGuardado()
  }

  return (
    <Modal titulo={socio ? 'Editar socio' : 'Nuevo socio'} onClose={onClose}>
      <form onSubmit={onSubmit} className="form">
        <Campo label="Nombre"><input className="input" required value={form.nombre} onChange={(e) => set('nombre', e.target.value)} autoFocus /></Campo>
        <div className="form-grid">
          <Campo label="Teléfono"><input className="input" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} /></Campo>
          <Campo label="Correo"><input className="input" type="email" value={form.correo} onChange={(e) => set('correo', e.target.value)} /></Campo>
        </div>
        {error && <Alerta>{error}</Alerta>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}
