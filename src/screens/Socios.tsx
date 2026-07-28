import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useBorrador } from '../lib/useBorrador'
import { mxn, porcentaje } from '../lib/helpers'
import { inputStyle, th, td, btnPrimario, btnSecundario } from '../lib/ui'
import { Modal, FormBotones } from '../components/Ui'
import type { Socio, Aportacion, Liquidacion, VehiculoFicha } from '../types'

/**
 * Solo admin (RLS: socio_admin, aportacion_admin, liquidacion_admin). Muestra
 * capital aportado por socio y las liquidaciones generadas al cerrar ventas
 * (ver Ventas y cierre) — RN de reparto de utilidad entre socios. Socios y
 * aportaciones se pueden editar y eliminar, no solo crear — el FK de
 * aportacion/liquidacion protege el borrado de un socio que ya tiene
 * historial.
 */
export default function Socios() {
  const [socios, setSocios] = useState<Socio[]>([])
  const [aportaciones, setAportaciones] = useState<Aportacion[]>([])
  const [liquidaciones, setLiquidaciones] = useState<(Liquidacion & { vehiculo_id_interno?: string; socio_nombre?: string })[]>([])
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [cargando, setCargando] = useState(true)
  const [abrirSocio, setAbrirSocio] = useState(false)
  const [socioEditando, setSocioEditando] = useState<Socio | null>(null)
  const [abrirAportacion, setAbrirAportacion] = useState(false)
  const [aportacionEditando, setAportacionEditando] = useState<Aportacion | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function recargar() {
    if (!supabase) return
    const [s, a, l, v] = await Promise.all([
      supabase.from('socio').select('*').order('nombre'),
      supabase.from('aportacion').select('*').order('fecha', { ascending: false }),
      supabase.from('liquidacion').select('*, vehiculo:vehiculo_id(id_interno), socio:socio_id(nombre)').order('fecha_pago', { ascending: false, nullsFirst: true }),
      supabase.from('v_vehiculo_ficha').select('id, id_interno, marca, modelo, anio').order('id_interno'),
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

  async function marcarPagada(id: number, pagado: boolean) {
    if (!supabase) return
    await supabase.from('liquidacion').update({ pagado, fecha_pago: pagado ? new Date().toISOString().slice(0, 10) : null }).eq('id', id)
    recargar()
  }

  async function cambiarActivoSocio(id: number, activo: boolean) {
    if (!supabase) return
    await supabase.from('socio').update({ activo }).eq('id', id)
    recargar()
  }

  async function eliminarSocio(socio: Socio) {
    if (!supabase) return
    setError(null)
    const { error: errBorrar } = await supabase.from('socio').delete().eq('id', socio.id)
    if (errBorrar) { setError(`No se puede eliminar a ${socio.nombre}: ya tiene aportaciones o liquidaciones registradas.`); return }
    recargar()
  }

  async function eliminarAportacion(aportacion: Aportacion) {
    if (!supabase) return
    setError(null)
    const { error: errBorrar } = await supabase.from('aportacion').delete().eq('id', aportacion.id)
    if (errBorrar) { setError(errBorrar.message); return }
    recargar()
  }

  function totalAportado(socioId: number) {
    return aportaciones.filter((a) => a.socio_id === socioId).reduce((acc, a) => acc + a.monto, 0)
  }

  function totalPendiente(socioId: number) {
    return liquidaciones.filter((l) => l.socio_id === socioId && !l.pagado).reduce((acc, l) => acc + l.monto_a_pagar, 0)
  }

  function nombreSocio(id: number) {
    return socios.find((s) => s.id === id)?.nombre ?? '—'
  }

  function unidadDe(id: number) {
    const v = vehiculos.find((v) => v.id === id)
    return v ? `${v.id_interno} · ${v.marca} ${v.modelo}` : '—'
  }

  if (cargando) return <p>Cargando…</p>

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h1 style={{ font: '400 26px Georgia, serif', margin: 0 }}>Socios</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setAbrirAportacion(true)} style={btnSecundario}>+ Registrar aportación</button>
          <button onClick={() => setAbrirSocio(true)} style={btnPrimario}>+ Nuevo socio</button>
        </div>
      </div>

      {error && <p style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)', marginBottom: 12 }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff', marginBottom: 28 }}>
        <thead>
          <tr style={{ background: '#faf9f6', textAlign: 'left' }}>
            {['Socio', 'Contacto', 'Capital aportado', 'Liquidación pendiente', 'Activo', ''].map((h) => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {socios.map((s) => (
            <tr key={s.id} style={{ borderTop: '1px solid #f0ede6' }}>
              <td style={td}>{s.nombre}</td>
              <td style={{ ...td, color: '#8b8578' }}>{s.telefono ?? s.correo ?? '—'}</td>
              <td style={{ ...td, textAlign: 'right' }}>{mxn(totalAportado(s.id))}</td>
              <td style={{ ...td, textAlign: 'right' }}>{mxn(totalPendiente(s.id))}</td>
              <td style={td}>
                <input type="checkbox" checked={s.activo} onChange={(e) => cambiarActivoSocio(s.id, e.target.checked)} />
              </td>
              <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button onClick={() => setSocioEditando(s)} style={{ background: 'none', border: 'none', color: '#8b8578', fontSize: 11, cursor: 'pointer', marginRight: 10, padding: 0 }}>editar</button>
                <button onClick={() => eliminarSocio(s)} style={{ background: 'none', border: 'none', color: '#8b8578', fontSize: 11, cursor: 'pointer', padding: 0 }}>eliminar</button>
              </td>
            </tr>
          ))}
          {socios.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#8b8578' }}>Sin socios capturados todavía.</td></tr>
          )}
        </tbody>
      </table>

      <h2 style={{ font: '500 15px "IBM Plex Sans"', borderBottom: '1.5px solid #26302f', paddingBottom: 8, marginBottom: 4 }}>
        Aportaciones
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff', marginBottom: 28 }}>
        <thead>
          <tr style={{ background: '#faf9f6', textAlign: 'left' }}>
            {['Socio', 'Unidad', 'Monto', 'Fecha', ''].map((h) => <th key={h} style={th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {aportaciones.map((a) => (
            <tr key={a.id} style={{ borderTop: '1px solid #f0ede6' }}>
              <td style={td}>{nombreSocio(a.socio_id)}</td>
              <td style={td}>{unidadDe(a.vehiculo_id)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{mxn(a.monto)}</td>
              <td style={td}>{a.fecha}</td>
              <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button onClick={() => setAportacionEditando(a)} style={{ background: 'none', border: 'none', color: '#8b8578', fontSize: 11, cursor: 'pointer', marginRight: 10, padding: 0 }}>editar</button>
                <button onClick={() => eliminarAportacion(a)} style={{ background: 'none', border: 'none', color: '#8b8578', fontSize: 11, cursor: 'pointer', padding: 0 }}>eliminar</button>
              </td>
            </tr>
          ))}
          {aportaciones.length === 0 && (
            <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#8b8578' }}>Sin aportaciones capturadas todavía.</td></tr>
          )}
        </tbody>
      </table>

      <h2 style={{ font: '500 15px "IBM Plex Sans"', borderBottom: '1.5px solid #26302f', paddingBottom: 8, marginBottom: 4 }}>
        Liquidaciones
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff' }}>
        <thead>
          <tr style={{ background: '#faf9f6', textAlign: 'left' }}>
            {['Unidad', 'Socio', 'Participación', 'Utilidad asignada', 'Monto a pagar', 'Pagado'].map((h) => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {liquidaciones.map((l) => (
            <tr key={l.id} style={{ borderTop: '1px solid #f0ede6' }}>
              <td style={td}>{l.vehiculo_id_interno ?? '—'}</td>
              <td style={td}>{l.socio_nombre ?? '—'}</td>
              <td style={{ ...td, textAlign: 'right' }}>{porcentaje(l.participacion)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{mxn(l.utilidad_asignada)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{mxn(l.monto_a_pagar)}</td>
              <td style={td}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <input type="checkbox" checked={l.pagado} onChange={(e) => marcarPagada(l.id, e.target.checked)} />
                  {l.pagado ? 'Sí' : 'No'}
                </label>
              </td>
            </tr>
          ))}
          {liquidaciones.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#8b8578' }}>Sin liquidaciones todavía — se generan al cerrar una venta.</td></tr>
          )}
        </tbody>
      </table>

      {(abrirSocio || socioEditando) && (
        <SocioModal
          socio={socioEditando}
          onClose={() => { setAbrirSocio(false); setSocioEditando(null) }}
          onGuardado={() => { setAbrirSocio(false); setSocioEditando(null); recargar() }}
        />
      )}
      {(abrirAportacion || aportacionEditando) && (
        <AportacionModal
          aportacion={aportacionEditando}
          socios={socios}
          vehiculos={vehiculos}
          onClose={() => { setAbrirAportacion(false); setAportacionEditando(null) }}
          onGuardado={() => { setAbrirAportacion(false); setAportacionEditando(null); recargar() }}
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
    const datos = { nombre: form.nombre, telefono: form.telefono || null, correo: form.correo || null }
    const { error } = socio
      ? await supabase.from('socio').update(datos).eq('id', socio.id)
      : await supabase.from('socio').insert(datos)
    setGuardando(false)
    if (error) { setError(error.message); return }
    limpiarBorrador()
    onGuardado()
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0, font: '500 16px Georgia, serif' }}>{socio ? 'Editar socio' : 'Nuevo socio'}</h3>
        <input required placeholder="Nombre" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} style={inputStyle} />
        <input placeholder="Teléfono" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} style={inputStyle} />
        <input placeholder="Correo" value={form.correo} onChange={(e) => set('correo', e.target.value)} style={inputStyle} />
        {error && <div style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)' }}>{error}</div>}
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
    fecha: aportacion?.fecha ?? new Date().toISOString().slice(0, 10),
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

  return (
    <Modal onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0, font: '500 16px Georgia, serif' }}>{aportacion ? 'Editar aportación' : 'Registrar aportación'}</h3>
        <select required value={form.socioId} onChange={(e) => set('socioId', e.target.value)} style={inputStyle}>
          <option value="">Socio…</option>
          {socios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select required value={form.vehiculoId} onChange={(e) => set('vehiculoId', e.target.value)} style={inputStyle}>
          <option value="">Unidad…</option>
          {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.id_interno} · {v.marca} {v.modelo} {v.anio}</option>)}
        </select>
        <input required type="number" step="0.01" placeholder="Monto" value={form.monto} onChange={(e) => set('monto', e.target.value)} style={inputStyle} />
        <input required type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} style={inputStyle} />
        {error && <div style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)' }}>{error}</div>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}
