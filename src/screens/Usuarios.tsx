import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ROL_LABEL } from '../lib/helpers'
import { PageHeader, Alerta, Cargando, Badge } from '../components/Ui'
import type { Perfil, Rol } from '../types'

const ROLES: Rol[] = ['admin', 'gerencia', 'comisionista', 'demo']

/** Solo admin. Quien se registra entra como Gerencia; aquí se ajusta el rol. */
export default function Usuarios() {
  const { perfil: yo } = useAuth()
  const [usuarios, setUsuarios] = useState<(Perfil & { correo?: string })[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function recargar() {
    if (!supabase) return
    const { data } = await supabase.from('perfil').select('*').order('nombre')
    setUsuarios((data ?? []) as Perfil[])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  async function actualizar(id: string, cambios: Partial<Perfil>) {
    if (!supabase) return
    setGuardandoId(id)
    setError(null)
    const { error } = await supabase.from('perfil').update(cambios).eq('id', id)
    if (error) setError(error.message)
    await recargar()
    setGuardandoId(null)
  }

  if (cargando) return <Cargando />

  return (
    <div className="contenido angosto" style={{ marginLeft: 0 }}>
      <PageHeader titulo="Usuarios" descripcion="Cambia el rol de cada persona o desactiva su acceso. Tu propia cuenta no se puede modificar aquí para que no te quedes fuera." />

      {error && <div style={{ marginBottom: 16 }}><Alerta>{error}</Alerta></div>}

      <div className="tabla-wrap">
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>Rol</th><th>Acceso</th></tr></thead>
          <tbody>
            {usuarios.map((u) => {
              const soyYo = u.id === yo?.id
              return (
                <tr key={u.id} className={guardandoId === u.id ? 'ocupado' : u.activo ? '' : 'inactivo'}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{u.nombre}</span> {soyYo && <Badge tono="primario">Tú</Badge>}
                    {u.correo && <span className="unidad-folio">{u.correo}</span>}
                  </td>
                  <td>
                    <select className="select select-chico" value={u.rol} disabled={soyYo} onChange={(e) => actualizar(u.id, { rol: e.target.value as Rol })}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
                    </select>
                  </td>
                  <td>
                    <label className="check">
                      <input type="checkbox" checked={u.activo} disabled={soyYo} onChange={(e) => actualizar(u.id, { activo: e.target.checked })} />
                      {u.activo ? 'Activo' : 'Desactivado'}
                    </label>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
