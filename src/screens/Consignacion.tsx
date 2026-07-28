import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { mxn } from '../lib/helpers'
import { inputStyle, selectStyle, th, td, btnPrimario, btnSecundario } from '../lib/ui'
import { Modal, FormBotones } from '../components/Ui'
import type { Lote, Consignacion as TConsignacion, VehiculoFicha } from '../types'

const ESTADOS: TConsignacion['estado'][] = ['en_consignacion', 'retirada', 'vendida_por_lote', 'conciliada']
const ESTADO_LABEL: Record<TConsignacion['estado'], string> = {
  en_consignacion: 'En consignación', retirada: 'Retirada', vendida_por_lote: 'Vendida por lote', conciliada: 'Conciliada',
}

type ConsignacionConVehiculo = TConsignacion & { vehiculo?: { id_interno: string; marca: string; modelo: string; anio: number } | null }

/** RN-27 a RN-30: unidades enviadas a lote (venta por terceros). admin/gerencia. */
export default function Consignacion() {
  const { perfil } = useAuth()
  const [lotes, setLotes] = useState<Lote[]>([])
  const [consignaciones, setConsignaciones] = useState<ConsignacionConVehiculo[]>([])
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [cargando, setCargando] = useState(true)
  const [abrirLote, setAbrirLote] = useState(false)
  const [abrirConsignacion, setAbrirConsignacion] = useState(false)

  const esAdmin = perfil?.rol === 'admin'
  const puedeAsignar = perfil?.rol === 'admin' || perfil?.rol === 'gerencia'

  async function recargar() {
    if (!supabase) return
    const [l, c, v] = await Promise.all([
      supabase.from('lote').select('*').order('nombre'),
      supabase.from('consignacion').select('*, vehiculo:vehiculo_id(id_interno, marca, modelo, anio)').order('fecha_envio', { ascending: false }),
      supabase.from('v_vehiculo_ficha').select('id, id_interno, marca, modelo, anio, precio_autorizado, fecha_compra').order('id_interno'),
    ])
    setLotes((l.data ?? []) as Lote[])
    setConsignaciones((c.data ?? []) as unknown as ConsignacionConVehiculo[])
    setVehiculos((v.data ?? []) as VehiculoFicha[])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  async function cambiarEstado(id: number, estado: TConsignacion['estado']) {
    if (!supabase) return
    await supabase.from('consignacion').update({
      estado, fecha_retiro: estado === 'retirada' ? new Date().toISOString().slice(0, 10) : null,
    }).eq('id', id)
    recargar()
  }

  if (cargando) return <p>Cargando…</p>

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h1 style={{ font: '400 26px Georgia, serif', margin: 0 }}>Consignación</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {puedeAsignar && <button onClick={() => setAbrirConsignacion(true)} style={btnSecundario}>+ Enviar unidad a lote</button>}
          {esAdmin && <button onClick={() => setAbrirLote(true)} style={btnPrimario}>+ Nuevo lote</button>}
        </div>
      </div>

      {lotes.length === 0 && <p style={{ fontSize: 12, color: '#8b8578' }}>Sin lotes registrados todavía.</p>}

      {lotes.map((lote) => {
        const filas = consignaciones.filter((c) => c.lote_id === lote.id)
        return (
          <div key={lote.id} style={{ marginBottom: 26 }}>
            <h2 style={{ font: '500 15px "IBM Plex Sans"', borderBottom: '1.5px solid #26302f', paddingBottom: 8, marginBottom: 4 }}>
              {lote.nombre} {lote.contacto && <span style={{ color: '#8b8578', fontWeight: 400, fontSize: 12 }}>· {lote.contacto}</span>}
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff' }}>
              <thead>
                <tr style={{ background: '#faf9f6' }}>
                  {['Unidad', 'Precio asignado', 'Envío', 'Estado'].map((h) => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filas.map((c) => (
                  <tr key={c.id} style={{ borderTop: '1px solid #f0ede6' }}>
                    <td style={td}>
                      <Link to={`/vehiculo/${c.vehiculo_id}`} style={{ color: '#1c1b19' }}>
                        {c.vehiculo ? `${c.vehiculo.id_interno} · ${c.vehiculo.marca} ${c.vehiculo.modelo} ${c.vehiculo.anio}` : `#${c.vehiculo_id}`}
                      </Link>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>{mxn(c.precio_asignado)}</td>
                    <td style={td}>{c.fecha_envio}</td>
                    <td style={td}>
                      {puedeAsignar ? (
                        <select value={c.estado} onChange={(e) => cambiarEstado(c.id, e.target.value as TConsignacion['estado'])} style={selectStyle}>
                          {ESTADOS.map((e) => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
                        </select>
                      ) : ESTADO_LABEL[c.estado]}
                    </td>
                  </tr>
                ))}
                {filas.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#8b8578' }}>Sin unidades en este lote.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
      })}

      {abrirLote && <LoteModal onClose={() => setAbrirLote(false)} onGuardado={() => { setAbrirLote(false); recargar() }} />}
      {abrirConsignacion && (
        <ConsignacionModal
          lotes={lotes}
          vehiculos={vehiculos}
          onClose={() => setAbrirConsignacion(false)}
          onGuardado={() => { setAbrirConsignacion(false); recargar() }}
        />
      )}
    </div>
  )
}

function LoteModal({ onClose, onGuardado }: { onClose: () => void; onGuardado: () => void }) {
  const [nombre, setNombre] = useState('')
  const [contacto, setContacto] = useState('')
  const [telefono, setTelefono] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    const { error } = await supabase.from('lote').insert({ nombre, contacto: contacto || null, telefono: telefono || null })
    setGuardando(false)
    if (error) { setError(error.message); return }
    onGuardado()
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0, font: '500 16px Georgia, serif' }}>Nuevo lote</h3>
        <input required placeholder="Nombre del lote" value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle} />
        <input placeholder="Contacto" value={contacto} onChange={(e) => setContacto(e.target.value)} style={inputStyle} />
        <input placeholder="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} style={inputStyle} />
        {error && <div style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)' }}>{error}</div>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}

function ConsignacionModal({ lotes, vehiculos, onClose, onGuardado }: {
  lotes: Lote[]
  vehiculos: VehiculoFicha[]
  onClose: () => void
  onGuardado: () => void
}) {
  const [vehiculoId, setVehiculoId] = useState('')
  const [loteId, setLoteId] = useState('')
  const [precio, setPrecio] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    const { error } = await supabase.from('consignacion').insert({
      vehiculo_id: Number(vehiculoId), lote_id: Number(loteId), precio_asignado: Number(precio), fecha_envio: fecha,
    })
    if (!error) {
      await supabase.from('vehiculo').update({ canal_venta: 'consignacion', estado_comercial: 'en_consignacion' }).eq('id', Number(vehiculoId))
    }
    setGuardando(false)
    if (error) { setError(error.message); return }
    onGuardado()
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0, font: '500 16px Georgia, serif' }}>Enviar unidad a lote</h3>
        <select required value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)} style={inputStyle}>
          <option value="">Unidad…</option>
          {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.id_interno} · {v.marca} {v.modelo} {v.anio}</option>)}
        </select>
        <select required value={loteId} onChange={(e) => setLoteId(e.target.value)} style={inputStyle}>
          <option value="">Lote…</option>
          {lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
        <input required type="number" step="0.01" placeholder="Precio asignado" value={precio} onChange={(e) => setPrecio(e.target.value)} style={inputStyle} />
        <input required type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputStyle} />
        {error && <div style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)' }}>{error}</div>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}
