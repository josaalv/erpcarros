import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { mxn } from '../lib/helpers'
import type { VehiculoFicha } from '../types'

export default function Panel() {
  const { perfil } = useAuth()
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('v_vehiculo_ficha')
      .select('*')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        setVehiculos((data ?? []) as VehiculoFicha[])
        setCargando(false)
      })
  }, [])

  const veCifras = perfil?.rol === 'admin' || perfil?.rol === 'demo'
  const capital = vehiculos.reduce((acc, v) => acc + (v.costo_total ?? 0), 0)
  const listas = vehiculos.filter((v) => v.estado_comercial === 'publicado' || v.estado_comercial === 'apartado').length

  if (cargando) return <p>Cargando…</p>
  if (error) return <p style={{ color: 'oklch(0.48 0.13 32)' }}>Error consultando Supabase: {error}</p>

  return (
    <div>
      <h1 style={{ font: '400 26px Georgia, serif', margin: '0 0 4px' }}>Panel</h1>
      <p style={{ color: '#8b8578', fontSize: 12.5, marginTop: 0, marginBottom: 24 }}>
        {vehiculos.length} unidades {perfil?.rol === 'demo' ? '(datos de demostración)' : ''}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
        <Kpi label="Unidades activas" value={String(vehiculos.length)} />
        <Kpi label="Listas / apartadas" value={String(listas)} />
        <Kpi label={veCifras ? 'Capital comprometido' : 'Capital comprometido'} value={veCifras ? mxn(capital) : '—'} nota={veCifras ? undefined : 'Sin permiso para ver importes'} />
      </div>

      <h2 style={{ font: '500 15px "IBM Plex Sans"', borderBottom: '1.5px solid #26302f', paddingBottom: 8, marginBottom: 4 }}>
        Unidades
      </h2>
      <VehiculoTabla vehiculos={vehiculos} veCifras={veCifras} />
    </div>
  )
}

function Kpi({ label, value, nota }: { label: string; value: string; nota?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e4e0d8', padding: '13px 15px' }}>
      <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8b8578', marginBottom: 6 }}>{label}</div>
      <div style={{ font: '400 24px Georgia, serif', color: '#1c1b19' }}>{value}</div>
      {nota && <div style={{ fontSize: 10.5, color: '#8b8578', marginTop: 4 }}>{nota}</div>}
    </div>
  )
}

export function VehiculoTabla({ vehiculos, veCifras }: { vehiculos: VehiculoFicha[]; veCifras: boolean }) {
  const navigate = useNavigate()
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff' }}>
      <thead>
        <tr style={{ background: '#faf9f6', textAlign: 'left' }}>
          {['Unidad', 'Estado', 'Días', 'Precio', veCifras ? 'Costo' : null, veCifras ? 'Utilidad' : null].filter(Boolean).map((h) => (
            <th key={h} style={{ padding: '9px 10px', borderBottom: '1px solid #e4e0d8', fontSize: 9.5, textTransform: 'uppercase', color: '#6b665c' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {vehiculos.map((v) => {
          const dias = v.fecha_compra ? Math.floor((Date.now() - new Date(v.fecha_compra).getTime()) / 86400000) : null
          return (
            <tr key={v.id} onClick={() => navigate(`/vehiculo/${v.id}`)} style={{ borderTop: '1px solid #f0ede6', cursor: 'pointer' }}>
              <td style={{ padding: '10px' }}>{v.marca} {v.modelo} {v.anio} <span style={{ color: '#8b8578' }}>· {v.id_interno}</span></td>
              <td style={{ padding: '10px' }}>{v.estado_comercial}</td>
              <td style={{ padding: '10px', textAlign: 'right' }}>{dias ?? '—'}</td>
              <td style={{ padding: '10px', textAlign: 'right' }}>{mxn(v.precio_autorizado)}</td>
              {veCifras && <td style={{ padding: '10px', textAlign: 'right' }}>{mxn(v.costo_total)}</td>}
              {veCifras && <td style={{ padding: '10px', textAlign: 'right' }}>{mxn(v.utilidad)}</td>}
            </tr>
          )
        })}
        {vehiculos.length === 0 && (
          <tr><td colSpan={veCifras ? 6 : 4} style={{ padding: 20, textAlign: 'center', color: '#8b8578' }}>Sin unidades capturadas todavía.</td></tr>
        )}
      </tbody>
    </table>
  )
}
