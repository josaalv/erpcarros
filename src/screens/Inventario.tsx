import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { mxn } from '../lib/helpers'
import type { VehiculoFicha } from '../types'

export default function Inventario() {
  const { perfil } = useAuth()
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('v_vehiculo_ficha')
      .select('*')
      .order('id_interno')
      .then(({ data }) => {
        setVehiculos((data ?? []) as VehiculoFicha[])
        setCargando(false)
      })
  }, [])

  const veMinimo = perfil?.rol === 'admin'
  const q = busqueda.trim().toLowerCase()
  const filtrados = vehiculos.filter((v) =>
    !q || `${v.id_interno} ${v.marca} ${v.modelo} ${v.anio}`.toLowerCase().includes(q)
  )

  return (
    <div>
      <h1 style={{ font: '400 26px Georgia, serif', margin: '0 0 16px' }}>Inventario</h1>

      <input
        placeholder="Buscar por marca, modelo, año o folio…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ padding: '8px 10px', border: '1px solid #ddd8d0', fontSize: 13, width: 320, marginBottom: 16 }}
      />

      {cargando ? (
        <p>Cargando…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff' }}>
          <thead>
            <tr style={{ background: '#faf9f6', textAlign: 'left' }}>
              {['Unidad', 'Km', 'Estado', 'Documental', 'Precio autorizado', veMinimo ? 'Precio mínimo' : null]
                .filter(Boolean)
                .map((h) => (
                  <th key={h} style={{ padding: '9px 10px', borderBottom: '1px solid #e4e0d8', fontSize: 9.5, textTransform: 'uppercase', color: '#6b665c' }}>{h}</th>
                ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((v) => (
              <tr key={v.id} style={{ borderTop: '1px solid #f0ede6' }}>
                <td style={{ padding: '10px' }}>{v.marca} {v.modelo} {v.anio} <span style={{ color: '#8b8578' }}>· {v.id_interno}</span></td>
                <td style={{ padding: '10px' }}>{v.kilometraje?.toLocaleString('es-MX') ?? '—'} km</td>
                <td style={{ padding: '10px' }}>{v.estado_comercial}</td>
                <td style={{ padding: '10px' }}>{v.estado_documental}</td>
                <td style={{ padding: '10px', textAlign: 'right' }}>{mxn(v.precio_autorizado)}</td>
                {veMinimo && <td style={{ padding: '10px', textAlign: 'right' }}>{mxn(v.precio_minimo)}</td>}
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#8b8578' }}>Sin unidades capturadas todavía.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
