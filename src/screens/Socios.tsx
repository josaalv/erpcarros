import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { mxn, porcentaje } from '../lib/helpers'
import { inputStyle, th, td, btnPrimario, btnSecundario } from '../lib/ui'
import { Modal, FormBotones } from '../components/Ui'
import type { Socio, Aportacion, Liquidacion, VehiculoFicha } from '../types'

/**
 * Solo admin (RLS: socio_admin, aportacion_admin, liquidacion_admin). Muestra
 * capital aportado por socio y las liquidaciones generadas al cerrar ventas
 * (ver Ventas y cierre) — RN de reparto de utilidad entre socios.
 */
export default function Socios() {
  const [socios, setSocios] = useState<Socio[]>([])
  const [aportaciones, setAportaciones] = useState<Aportacion[]>([])
  const [liquidaciones, setLiquidaciones] = useState<(Liquidacion & { vehiculo_id_interno?: string; socio_nombre?: string })[]>([])
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [cargando, setCargando] = useState(true)
  const [abrirSocio, setAbrirSocio] = useState(false)
  const [abrirAportacion, setAbrirAportacion] = useState(false)

  async function recargar() {
    if (!supabase) return
    const [s, a, l, v] = await Promise.all([
      supabase.from('socio').select('*').order('nombre'),
      supabase.from('aportacion').select('*'),
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

  function totalAportado(socioId: number) {
    return aportaciones.filter((a) => a.socio_id === socioId).reduce((acc, a) => acc + a.monto, 0)
  }

  function totalPendiente(socioId: number) {
    return liquidaciones.filter((l) => l.socio_id === socioId && !l.pagado).reduce((acc, l) => acc + l.monto_a_pagar, 0)
  }

  if (cargando) return <p>Cargando…</p>

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h1 style={{ font: '400 26px Georgia, serif', margin: 0 }}>Socios</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setAbrirAportacion(true)} style={btnSecundario}>+ Registrar aportación</button>
          <button onClick={() => setAbrirSocio(true)} style={btnPrimario}>+ Nuevo socio</button>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff', marginBottom: 28 }}>
        <thead>
          <tr style={{ background: '#faf9f6', textAlign: 'left' }}>
            {['Socio', 'Contacto', 'Capital aportado', 'Liquidación pendiente', 'Activo'].map((h) => (
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
              <td style={td}>{s.activo ? 'Sí' : 'No'}</td>
            </tr>
          ))}
          {socios.length === 0 && (
            <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#8b8578' }}>Sin socios capturados todavía.</td></tr>
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

      {abrirSocio && <SocioModal onClose={() => setAbrirSocio(false)} onGuardado={() => { setAbrirSocio(false); recargar() }} />}
      {abrirAportacion && (
        <AportacionModal
          socios={socios}
          vehiculos={vehiculos}
          onClose={() => setAbrirAportacion(false)}
          onGuardado={() => { setAbrirAportacion(false); recargar() }}
        />
      )}
    </div>
  )
}

function SocioModal({ onClose, onGuardado }: { onClose: () => void; onGuardado: () => void }) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [correo, setCorreo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    const { error } = await supabase.from('socio').insert({ nombre, telefono: telefono || null, correo: correo || null })
    setGuardando(false)
    if (error) { setError(error.message); return }
    onGuardado()
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0, font: '500 16px Georgia, serif' }}>Nuevo socio</h3>
        <input required placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle} />
        <input placeholder="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} style={inputStyle} />
        <input placeholder="Correo" value={correo} onChange={(e) => setCorreo(e.target.value)} style={inputStyle} />
        {error && <div style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)' }}>{error}</div>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}

function AportacionModal({ socios, vehiculos, onClose, onGuardado }: {
  socios: Socio[]
  vehiculos: VehiculoFicha[]
  onClose: () => void
  onGuardado: () => void
}) {
  const [socioId, setSocioId] = useState('')
  const [vehiculoId, setVehiculoId] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    const { error } = await supabase.from('aportacion').insert({
      socio_id: Number(socioId), vehiculo_id: Number(vehiculoId), monto: Number(monto), fecha,
    })
    setGuardando(false)
    if (error) { setError(error.message); return }
    onGuardado()
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0, font: '500 16px Georgia, serif' }}>Registrar aportación</h3>
        <select required value={socioId} onChange={(e) => setSocioId(e.target.value)} style={inputStyle}>
          <option value="">Socio…</option>
          {socios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select required value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)} style={inputStyle}>
          <option value="">Unidad…</option>
          {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.id_interno} · {v.marca} {v.modelo} {v.anio}</option>)}
        </select>
        <input required type="number" step="0.01" placeholder="Monto" value={monto} onChange={(e) => setMonto(e.target.value)} style={inputStyle} />
        <input required type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputStyle} />
        {error && <div style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)' }}>{error}</div>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}

