import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { inputStyle, selectStyle, btnPrimario } from '../lib/ui'
import { Modal, FormBotones } from '../components/Ui'
import type { OrdenTrabajo, VehiculoFicha } from '../types'

const ESTADOS: { clave: OrdenTrabajo['estado']; nombre: string }[] = [
  { clave: 'abierta', nombre: 'Abierta' },
  { clave: 'en_proceso', nombre: 'En proceso' },
  { clave: 'espera_piezas', nombre: 'Espera de piezas' },
  { clave: 'terminada', nombre: 'Terminada' },
  { clave: 'cancelada', nombre: 'Cancelada' },
]

type OrdenConVehiculo = OrdenTrabajo & { vehiculo?: { id_interno: string; marca: string; modelo: string; anio: number } | null }

/**
 * Tablero kanban de órdenes de trabajo (admin/gerencia — RLS ot_select).
 * Arrastrar no es necesario para el volumen del negocio (12 unidades
 * activas); cambiar de columna con un select es más rápido de construir
 * y de auditar que drag-and-drop.
 */
export default function Taller() {
  const { perfil } = useAuth()
  const [ordenes, setOrdenes] = useState<OrdenConVehiculo[]>([])
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [cargando, setCargando] = useState(true)
  const [abrirNueva, setAbrirNueva] = useState(false)

  const puedeEditar = perfil?.rol === 'admin' || perfil?.rol === 'gerencia'

  async function recargar() {
    if (!supabase) return
    const [o, v] = await Promise.all([
      supabase.from('orden_trabajo').select('*, vehiculo:vehiculo_id(id_interno, marca, modelo, anio)').order('created_at', { ascending: false }),
      supabase.from('v_vehiculo_ficha').select('id, id_interno, marca, modelo, anio').order('id_interno'),
    ])
    setOrdenes((o.data ?? []) as unknown as OrdenConVehiculo[])
    setVehiculos((v.data ?? []) as VehiculoFicha[])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  async function cambiarEstado(id: number, estado: OrdenTrabajo['estado']) {
    if (!supabase) return
    await supabase.from('orden_trabajo').update({
      estado, fecha_real: estado === 'terminada' ? new Date().toISOString().slice(0, 10) : null,
    }).eq('id', id)
    recargar()
  }

  if (cargando) return <p>Cargando…</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h1 style={{ font: '400 26px Georgia, serif', margin: 0 }}>Taller</h1>
        {puedeEditar && <button onClick={() => setAbrirNueva(true)} style={btnPrimario}>+ Nueva orden</button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, alignItems: 'start' }}>
        {ESTADOS.map((col) => (
          <div key={col.clave}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8b8578', marginBottom: 8, borderBottom: '1.5px solid #26302f', paddingBottom: 6 }}>
              {col.nombre} · {ordenes.filter((o) => o.estado === col.clave).length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ordenes.filter((o) => o.estado === col.clave).map((o) => (
                <div key={o.id} style={{ background: '#fff', border: '1px solid #e4e0d8', padding: 10 }}>
                  <div style={{ fontSize: 11, color: '#8b8578', marginBottom: 3 }}>{o.folio}</div>
                  <Link to={`/vehiculo/${o.vehiculo_id}`} style={{ fontSize: 12.5, fontWeight: 500, color: '#1c1b19', textDecoration: 'none' }}>
                    {o.vehiculo ? `${o.vehiculo.id_interno} · ${o.vehiculo.marca} ${o.vehiculo.modelo}` : `#${o.vehiculo_id}`}
                  </Link>
                  <div style={{ fontSize: 12, margin: '4px 0' }}>{o.descripcion}</div>
                  <div style={{ fontSize: 10.5, color: '#8b8578', marginBottom: puedeEditar ? 6 : 0 }}>
                    {o.tipo === 'interna' ? 'Interna' : 'Externa'} · prioridad {o.prioridad}
                    {o.es_retrabajo && ' · retrabajo'}
                  </div>
                  {puedeEditar && (
                    <select
                      value={o.estado}
                      onChange={(e) => cambiarEstado(o.id, e.target.value as OrdenTrabajo['estado'])}
                      style={{ ...selectStyle, width: '100%', fontSize: 11 }}
                    >
                      {ESTADOS.map((e) => <option key={e.clave} value={e.clave}>{e.nombre}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {abrirNueva && (
        <OrdenModal vehiculos={vehiculos} onClose={() => setAbrirNueva(false)} onGuardado={() => { setAbrirNueva(false); recargar() }} />
      )}
    </div>
  )
}

function OrdenModal({ vehiculos, onClose, onGuardado }: {
  vehiculos: VehiculoFicha[]
  onClose: () => void
  onGuardado: () => void
}) {
  const [vehiculoId, setVehiculoId] = useState('')
  const [tipo, setTipo] = useState<'interna' | 'externa'>('interna')
  const [descripcion, setDescripcion] = useState('')
  const [prioridad, setPrioridad] = useState<'baja' | 'normal' | 'alta'>('normal')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    const folio = `OT-${Date.now().toString().slice(-6)}`
    const { error } = await supabase.from('orden_trabajo').insert({
      folio, vehiculo_id: Number(vehiculoId), tipo, descripcion, prioridad, fecha_inicio: new Date().toISOString().slice(0, 10),
    })
    setGuardando(false)
    if (error) { setError(error.message); return }
    onGuardado()
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0, font: '500 16px Georgia, serif' }}>Nueva orden de trabajo</h3>
        <select required value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)} style={inputStyle}>
          <option value="">Unidad…</option>
          {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.id_interno} · {v.marca} {v.modelo} {v.anio}</option>)}
        </select>
        <select value={tipo} onChange={(e) => setTipo(e.target.value as 'interna' | 'externa')} style={inputStyle}>
          <option value="interna">Interna</option>
          <option value="externa">Externa</option>
        </select>
        <input required placeholder="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} style={inputStyle} />
        <select value={prioridad} onChange={(e) => setPrioridad(e.target.value as 'baja' | 'normal' | 'alta')} style={inputStyle}>
          <option value="baja">Prioridad baja</option>
          <option value="normal">Prioridad normal</option>
          <option value="alta">Prioridad alta</option>
        </select>
        {error && <div style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)' }}>{error}</div>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}
