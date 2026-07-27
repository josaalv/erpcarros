import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCatalogos } from '../lib/catalogos'
import { useAuth } from '../lib/auth'

/**
 * Alta de vehículo (RN-02: cada vehículo es un centro de costos
 * independiente — nada existe sin la unidad). precio_minimo solo se pide
 * si el rol es admin; gerencia da de alta "sin importes" (Tabla 2).
 */
export default function VehiculoNuevo() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const { estados, ubicaciones, cargando } = useCatalogos()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    id_interno: '', marca: '', modelo: '', anio: new Date().getFullYear(),
    kilometraje: '', color: '', transmision: 'manual',
    estado_proceso_id: '', ubicacion_id: '', fecha_compra: '',
    precio_minimo: '', precio_autorizado: '',
  })

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setError(null)
    setGuardando(true)

    const { data, error } = await supabase
      .from('vehiculo')
      .insert({
        id_interno: form.id_interno,
        marca: form.marca,
        modelo: form.modelo,
        anio: Number(form.anio),
        kilometraje: form.kilometraje ? Number(form.kilometraje) : null,
        color: form.color || null,
        transmision: form.transmision,
        estado_proceso_id: Number(form.estado_proceso_id),
        ubicacion_id: Number(form.ubicacion_id),
        fecha_compra: form.fecha_compra || null,
        precio_minimo: form.precio_minimo ? Number(form.precio_minimo) : null,
        precio_autorizado: form.precio_autorizado ? Number(form.precio_autorizado) : null,
      })
      .select('id')
      .single()

    setGuardando(false)

    if (error) {
      setError(error.message)
      return
    }

    navigate(`/vehiculo/${data.id}`)
  }

  if (cargando) return <p>Cargando catálogos…</p>

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ font: '400 26px Georgia, serif', margin: '0 0 16px' }}>Nueva unidad</h1>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Campo label="Folio interno (ej. V-0001)">
          <input required value={form.id_interno} onChange={(e) => set('id_interno', e.target.value)} style={inputStyle} />
        </Campo>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 10 }}>
          <Campo label="Marca"><input required value={form.marca} onChange={(e) => set('marca', e.target.value)} style={inputStyle} /></Campo>
          <Campo label="Modelo"><input required value={form.modelo} onChange={(e) => set('modelo', e.target.value)} style={inputStyle} /></Campo>
          <Campo label="Año"><input required type="number" value={form.anio} onChange={(e) => set('anio', e.target.value)} style={inputStyle} /></Campo>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Campo label="Kilometraje"><input type="number" value={form.kilometraje} onChange={(e) => set('kilometraje', e.target.value)} style={inputStyle} /></Campo>
          <Campo label="Color"><input value={form.color} onChange={(e) => set('color', e.target.value)} style={inputStyle} /></Campo>
          <Campo label="Transmisión">
            <select value={form.transmision} onChange={(e) => set('transmision', e.target.value)} style={inputStyle}>
              <option value="manual">Manual</option>
              <option value="automatica">Automática</option>
              <option value="otra">Otra</option>
            </select>
          </Campo>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Campo label="Estado de proceso">
            <select required value={form.estado_proceso_id} onChange={(e) => set('estado_proceso_id', e.target.value)} style={inputStyle}>
              <option value="">Selecciona…</option>
              {estados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Ubicación">
            <select required value={form.ubicacion_id} onChange={(e) => set('ubicacion_id', e.target.value)} style={inputStyle}>
              <option value="">Selecciona…</option>
              {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </Campo>
        </div>

        <Campo label="Fecha de compra (arranca los días de inventario, RN-04)">
          <input type="date" value={form.fecha_compra} onChange={(e) => set('fecha_compra', e.target.value)} style={inputStyle} />
        </Campo>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Campo label="Precio autorizado (venta directa)">
            <input type="number" value={form.precio_autorizado} onChange={(e) => set('precio_autorizado', e.target.value)} style={inputStyle} />
          </Campo>
          {perfil?.rol === 'admin' && (
            <Campo label="Precio mínimo interno (solo tú lo ves)">
              <input type="number" value={form.precio_minimo} onChange={(e) => set('precio_minimo', e.target.value)} style={inputStyle} />
            </Campo>
          )}
        </div>

        {error && <div style={{ fontSize: 12.5, color: 'oklch(0.48 0.13 32)', background: 'oklch(0.97 0.025 32)', padding: '8px 10px', border: '1px solid oklch(0.5 0.11 35)' }}>{error}</div>}

        <button type="submit" disabled={guardando} style={{ marginTop: 8, padding: '11px', background: '#26302f', color: '#f3f1ec', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          {guardando ? 'Guardando…' : 'Guardar unidad'}
        </button>
      </form>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, color: '#55524b' }}>
      {label}
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = { padding: '8px 10px', border: '1px solid #ddd8d0', fontSize: 13.5, fontFamily: 'inherit' }
