import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { ROL_LABEL } from '../lib/helpers'
import { inputStyle, btnPrimario } from '../lib/ui'

/** Cambiar contraseña estando ya dentro del sistema — antes solo existía
 * el flujo de "olvidé mi contraseña" desde el login. */
export default function MiCuenta() {
  const { perfil, actualizarPassword } = useAuth()
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
    <div style={{ maxWidth: 420 }}>
      <h1 style={{ font: '400 26px Georgia, serif', margin: '0 0 4px' }}>Mi cuenta</h1>
      <p style={{ color: '#8b8578', fontSize: 12.5, marginTop: 0, marginBottom: 24 }}>
        {perfil?.nombre} · {perfil ? ROL_LABEL[perfil.rol] : ''}
      </p>

      <div style={{ background: '#fff', border: '1px solid #e4e0d8', padding: 18 }}>
        <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8b8578', marginBottom: 14 }}>
          Cambiar contraseña
        </div>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, color: '#55524b' }}>
            Nueva contraseña
            <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} style={inputStyle} minLength={6} required />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, color: '#55524b' }}>
            Confirmar contraseña
            <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} style={inputStyle} minLength={6} required />
          </label>
          {error && <div style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)' }}>{error}</div>}
          {ok && <div style={{ fontSize: 11.5, color: 'oklch(0.45 0.09 150)' }}>Contraseña actualizada ✓</div>}
          <button type="submit" disabled={guardando} style={{ ...btnPrimario, marginTop: 4, alignSelf: 'flex-start' }}>
            {guardando ? 'Guardando…' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
