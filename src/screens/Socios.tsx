import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useBorrador } from '../lib/useBorrador'
import { mxn, porcentaje, fecha, hoyISO } from '../lib/helpers'
import { Modal, FormBotones, PageHeader, Campo, Alerta, Cargando, Kpi, Badge } from '../components/Ui'
import type { Socio, Aportacion, Liquidacion, VehiculoFicha } from '../types'

type LiquidacionVista = Liquidacion & { vehiculo_id_interno?: string; socio_nombre?: string }
type Pestana = 'socios' | 'aportaciones' | 'liquidaciones'

/**
 * Solo admin. El FK de aportacion/liquidacion impide borrar un socio con
 * historial; para dejar de usarlo se desactiva.
 */
export default function Socios() {
  const [socios, setSocios] = useState<Socio[]>([])
  const [aportaciones, setAportaciones] = useState<Aportacion[]>([])
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionVista[]>([])
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [cargando, setCargando] = useState(true)
  const [pestana, setPestana] = useState<Pestana>('socios')
  const [socioModal, setSocioModal] = useState<Socio | 'nuevo' | null>(null)
  const [aportacionModal, setAportacionModal] = useState<Aportacion | 'nueva' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function recargar() {
    if (!supabase) return
    const [s, a, l, v] = await Promise.all([
      supabase.from('socio').select('*').order('nombre'),
      supabase.from('aportacion').select('*').order('fecha', { ascending: false }),
      supabase.from('liquidacion').select('*, vehiculo:vehiculo_id(id_interno), socio:socio_id(nombre)').order('pagado').order('id', { ascending: false }),
      supabase.from('v_vehiculo_ficha').select('id, id_interno, marca, modelo, anio, estado_comercial').order('id_interno'),
    ])
    setSocios((s.data ?? []) as Socio[])
    setAportaciones((a.data ?? []) as Aportacion[])
    setLiquidaciones(((l.data ?? []) as Record<string, unknown>[]).map((row) => ({
      ...(row as unknown as Liquidacion),
      vehiculo_id_interno: (row.vehiculo as { id_interno?: string } | null)?.id_interno,
      socio_nombre: (row.socio as { nombre?: string } | null)?.nombre,
    })))
    setVehiculos((v.data ?? []) as VehiculoFicha[])
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

  const totalAportado = (sid: number) => aportaciones.filter((a) => a.socio_id === sid).reduce((acc, a) => acc + a.monto, 0)
  const totalPendiente = (sid: number) => liquidaciones.filter((l) => l.socio_id === sid && !l.pagado).reduce((acc, l) => acc + l.monto_a_pagar, 0)
  const nombreSocio = (sid: number) => socios.find((s) => s.id === sid)?.nombre ?? '—'
  const unidadDe = (vid: number) => {
    const v = vehiculos.find((x) => x.id === vid)
    return v ? `${v.marca} ${v.modelo} ${v.anio}` : '—'
  }
  const folioDe = (vid: number) => vehiculos.find((x) => x.id === vid)?.id_interno ?? ''
  const pendientesPago = liquidaciones.filter((l) => !l.pagado)

  return (
    <div>
      <PageHeader
        titulo="Socios"
        descripcion="Quién puso capital en cada unidad y cuánto se le debe al cerrar las ventas."
        acciones={
          <>
            <button className="btn btn-secundario" onClick={() => setAportacionModal('nueva')}>+ Registrar aportación</button>
            <button className="btn btn-primario" onClick={() => setSocioModal('nuevo')}>+ Nuevo socio</button>
          </>
        }
      />

      <div className="kpis">
        <Kpi label="Socios activos" valor={String(socios.filter((s) => s.activo).length)} />
        <Kpi label="Capital aportado" valor={mxn(aportaciones.reduce((acc, a) => acc + a.monto, 0))} />
        <Kpi label="Por pagar a socios" valor={mxn(pendientesPago.reduce((acc, l) => acc + l.monto_a_pagar, 0))} nota={`${pendientesPago.length} liquidaciones pendientes`} />
      </div>

      {error && <div style={{ marginBottom: 16 }}><Alerta>{error}</Alerta></div>}

      <div className="tabs">
        <button className={`tab${pestana === 'socios' ? ' activa' : ''}`} onClick={() => setPestana('socios')}>Socios ({socios.length})</button>
        <button className={`tab${pestana === 'aportaciones' ? ' activa' : ''}`} onClick={() => setPestana('aportaciones')}>Aportaciones ({aportaciones.length})</button>
        <button className={`tab${pestana === 'liquidaciones' ? ' activa' : ''}`} onClick={() => setPestana('liquidaciones')}>Liquidaciones ({pendientesPago.length} por pagar)</button>
      </div>

      {pestana === 'socios' && (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr><th>Socio</th><th>Contacto</th><th className="num">Capital aportado</th><th className="num">Por pagarle</th><th>Activo</th><th></th></tr>
            </thead>
            <tbody>
              {socios.map((s) => (
                <tr key={s.id} className={s.activo ? '' : 'inactivo'}>
                  <td style={{ fontWeight: 600 }}>{s.nombre}</td>
                  <td className="texto-suave">{[s.telefono, s.correo].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="num">{mxn(totalAportado(s.id))}</td>
                  <td className="num">{mxn(totalPendiente(s.id))}</td>
                  <td>
                    <label className="check">
                      <input type="checkbox" checked={s.activo} onChange={(e) => ejecutar(supabase!.from('socio').update({ activo: e.target.checked }).eq('id', s.id))} />
                      {s.activo ? 'Sí' : 'No'}
                    </label>
                  </td>
                  <td className="acciones-celda">
                    <button className="btn-link" onClick={() => setSocioModal(s)}>Editar</button>
                    <button className="btn-link peligro" onClick={() => {
                      if (window.confirm(`¿Eliminar a ${s.nombre}?`)) {
                        ejecutar(supabase!.from('socio').delete().eq('id', s.id), `No se puede eliminar a ${s.nombre} porque ya tiene aportaciones o liquidaciones. Puedes desactivarlo.`)
                      }
                    }}>Eliminar</button>
                  </td>
                </tr>
              ))}
              {socios.length === 0 && <tr><td colSpan={6} className="vacio">Todavía no hay socios.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {pestana === 'aportaciones' && (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Socio</th><th>Unidad</th><th className="num">Monto</th><th></th></tr></thead>
            <tbody>
              {aportaciones.map((a) => (
                <tr key={a.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fecha(a.fecha)}</td>
                  <td style={{ fontWeight: 500 }}>{nombreSocio(a.socio_id)}</td>
                  <td>{unidadDe(a.vehiculo_id)}<span className="unidad-folio">{folioDe(a.vehiculo_id)}</span></td>
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
              {aportaciones.length === 0 && <tr><td colSpan={5} className="vacio">Todavía no hay aportaciones.</td></tr>}
            </tbody>
          </table>
        </div>
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
        <AportacionModal
          aportacion={aportacionModal === 'nueva' ? null : aportacionModal}
          socios={socios}
          vehiculos={vehiculos}
          onClose={() => setAportacionModal(null)}
          onGuardado={() => { setAportacionModal(null); recargar() }}
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

function AportacionModal({ aportacion, socios, vehiculos, onClose, onGuardado }: {
  aportacion: Aportacion | null
  socios: Socio[]
  vehiculos: VehiculoFicha[]
  onClose: () => void
  onGuardado: () => void
}) {
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:aportacion:${aportacion?.id ?? 'nueva'}`, {
    socioId: aportacion ? String(aportacion.socio_id) : '',
    vehiculoId: aportacion ? String(aportacion.vehiculo_id) : '',
    monto: aportacion ? String(aportacion.monto) : '',
    fecha: aportacion?.fecha ?? hoyISO(),
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    const datos = { socio_id: Number(form.socioId), vehiculo_id: Number(form.vehiculoId), monto: Number(form.monto), fecha: form.fecha }
    const { error } = aportacion
      ? await supabase.from('aportacion').update(datos).eq('id', aportacion.id)
      : await supabase.from('aportacion').insert(datos)
    setGuardando(false)
    if (error) { setError(error.message); return }
    limpiarBorrador()
    onGuardado()
  }

  const activos = vehiculos.filter((v) => v.estado_comercial !== 'vendido' || String(v.id) === form.vehiculoId)

  return (
    <Modal titulo={aportacion ? 'Editar aportación' : 'Registrar aportación'} onClose={onClose}>
      <form onSubmit={onSubmit} className="form">
        <Campo label="Socio">
          <select className="select" required value={form.socioId} onChange={(e) => set('socioId', e.target.value)}>
            <option value="">Elige un socio…</option>
            {socios.filter((s) => s.activo || String(s.id) === form.socioId).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Unidad">
          <select className="select" required value={form.vehiculoId} onChange={(e) => set('vehiculoId', e.target.value)}>
            <option value="">Elige una unidad…</option>
            {activos.map((v) => <option key={v.id} value={v.id}>{v.id_interno} · {v.marca} {v.modelo} {v.anio}</option>)}
          </select>
        </Campo>
        <div className="form-grid">
          <Campo label="Monto"><input className="input" required type="number" step="0.01" min={0} value={form.monto} onChange={(e) => set('monto', e.target.value)} /></Campo>
          <Campo label="Fecha"><input className="input" required type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} /></Campo>
        </div>
        {error && <Alerta>{error}</Alerta>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}
