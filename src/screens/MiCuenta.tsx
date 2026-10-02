import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { ROL_LABEL } from '../lib/helpers'
import { PageHeader, Campo, Alerta } from '../components/Ui'

export default function MiCuenta() {
  const { perfil, session, actualizarPassword } = useAuth()
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(false)
    if (nueva.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (nueva !== confirmar) { setError('Las contraseñas no coinciden.'); return }
    setGuardando(true)
    const resultado = await actualizarPassword(nueva)
    setGuardando(false)
    if (resultado) { setError(resultado); return }
    setOk(true)
    setNueva('')
    setConfirmar('')
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <PageHeader titulo="Mi cuenta" />

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="avatar">{perfil?.nombre.charAt(0).toUpperCase()}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 17 }}>{perfil?.nombre}</div>
          <div className="texto-suave">{perfil ? ROL_LABEL[perfil.rol] : ''} · {session?.user.email}</div>
        </div>
      </div>

      <form className="card" onSubmit={onSubmit}>
        <div className="card-titulo">Cambiar contraseña</div>
        <p className="card-sub">Mínimo 6 caracteres.</p>
        <div className="form">
          <Campo label="Nueva contraseña">
            <input className="input" type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} minLength={6} required autoComplete="new-password" />
          </Campo>
          <Campo label="Confirmar contraseña">
            <input className="input" type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} minLength={6} required autoComplete="new-password" />
          </Campo>
          {error && <Alerta>{error}</Alerta>}
          {ok && <Alerta tipo="ok">Contraseña actualizada.</Alerta>}
          <div className="form-acciones">
            <button type="submit" className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Actualizar contraseña'}</button>
          </div>
        </div>
      </form>
    </div>
  )
}
