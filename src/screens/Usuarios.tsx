import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ROL_LABEL } from '../lib/helpers'
import type { Perfil, Rol } from '../types'

const ROLES: Rol[] = ['admin', 'gerencia', 'comisionista', 'demo']

/**
 * Solo admin (RLS: perfil_update_admin). Todo el que se registra entra
 * como 'gerencia' por default salvo el primero (que es 'admin') — aquí
 * es donde el admin reclasifica al resto del equipo.
 */
export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Perfil[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState<string | null>(null)

  async function recargar() {
    if (!supabase) return
    const { data } = await supabase.from('perfil').select('*').order('nombre')
    setUsuarios((data ?? []) as Perfil[])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  async function cambiarRol(id: string, rol: Rol) {
    if (!supabase) return
    setGuardandoId(id)
    await supabase.from('perfil').update({ rol }).eq('id', id)
    await recargar()
    setGuardandoId(null)
  }

  async function cambiarActivo(id: string, activo: boolean) {
    if (!supabase) return
    setGuardandoId(id)
    await supabase.from('perfil').update({ activo }).eq('id', id)
    await recargar()
    setGuardandoId(null)
  }

  if (cargando) return <p>Cargando…</p>

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ font: '400 26px Georgia, serif', margin: '0 0 16px' }}>Usuarios</h1>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff' }}>
        <thead>
          <tr style={{ background: '#faf9f6', textAlign: 'left' }}>
            {['Nombre', 'Rol', 'Activo'].map((h) => (
              <th key={h} style={{ padding: '9px 10px', borderBottom: '1px solid #e4e0d8', fontSize: 9.5, textTransform: 'uppercase', color: '#6b665c' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id} style={{ borderTop: '1px solid #f0ede6', opacity: guardandoId === u.id ? 0.5 : 1 }}>
              <td style={{ padding: '9px 10px' }}>{u.nombre}</td>
              <td style={{ padding: '9px 10px' }}>
                <select
                  value={u.rol}
                  onChange={(e) => cambiarRol(u.id, e.target.value as Rol)}
                  style={{ padding: '5px 7px', border: '1px solid #ddd8d0', fontSize: 12, fontFamily: 'inherit' }}
                >
                  {ROLES.map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
                </select>
              </td>
              <td style={{ padding: '9px 10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <input type="checkbox" checked={u.activo} onChange={(e) => cambiarActivo(u.id, e.target.checked)} />
                  {u.activo ? 'Activo' : 'Desactivado'}
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
