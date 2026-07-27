import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { hasSupabase } from '../lib/supabase'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [modo, setModo] = useState<'entrar' | 'registrar'>('entrar')
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)
    setEnviando(true)

    const resultado = modo === 'entrar'
      ? await signIn(correo, password)
      : await signUp(correo, password, nombre)

    setEnviando(false)

    if (resultado) {
      setError(resultado)
      return
    }

    if (modo === 'registrar') {
      setAviso('Cuenta creada. Si tu proyecto de Supabase pide confirmar correo, revisa tu bandeja; si no, ya puedes entrar.')
      setModo('entrar')
    }
  }

  if (!hasSupabase) {
    return (
      <div style={estilos.pagina}>
        <div style={estilos.tarjeta}>
          <p>Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={estilos.pagina}>
      <form style={estilos.tarjeta} onSubmit={onSubmit}>
        <div style={estilos.marca}>ERP Vehículos</div>
        <h1 style={estilos.titulo}>{modo === 'entrar' ? 'Entra a tu cuenta' : 'Crear cuenta'}</h1>

        {modo === 'registrar' && (
          <label style={estilos.campo}>
            Nombre
            <input style={estilos.input} value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </label>
        )}

        <label style={estilos.campo}>
          Correo electrónico
          <input style={estilos.input} type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
        </label>

        <label style={estilos.campo}>
          Contraseña
          <input style={estilos.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </label>

        {error && <div style={estilos.error}>{error}</div>}
        {aviso && <div style={estilos.aviso}>{aviso}</div>}

        <button style={estilos.boton} type="submit" disabled={enviando}>
          {enviando ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Registrarme'}
        </button>

        <button
          type="button"
          style={estilos.enlace}
          onClick={() => { setModo(modo === 'entrar' ? 'registrar' : 'entrar'); setError(null); setAviso(null) }}
        >
          {modo === 'entrar' ? 'No tengo cuenta — registrarme' : 'Ya tengo cuenta — entrar'}
        </button>

        {modo === 'registrar' && (
          <p style={estilos.nota}>
            La primera persona que se registra en el sistema se vuelve administrador automáticamente.
            Las siguientes entran como Gerencia; el administrador puede cambiar su rol después.
          </p>
        )}
      </form>
    </div>
  )
}

const estilos: Record<string, React.CSSProperties> = {
  pagina: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#f7f5f0', fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
  },
  tarjeta: {
    width: 380, background: '#fff', border: '1px solid #e4e0d8', padding: '32px 28px',
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  marca: {
    font: '600 10px/1 "IBM Plex Mono", monospace', letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'oklch(0.45 0.09 215)',
  },
  titulo: { font: '400 24px/1.2 Georgia, serif', color: '#1c1b19', margin: '0 0 6px' },
  campo: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: '#55524b' },
  input: { padding: '9px 10px', border: '1px solid #ddd8d0', fontSize: 14, fontFamily: 'inherit' },
  boton: {
    marginTop: 6, padding: '11px', background: '#26302f', color: '#f3f1ec', border: 'none',
    fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  enlace: { background: 'none', border: 'none', color: 'oklch(0.45 0.09 215)', fontSize: 12.5, cursor: 'pointer', padding: 0 },
  error: { fontSize: 12.5, color: 'oklch(0.48 0.13 32)', background: 'oklch(0.97 0.025 32)', padding: '8px 10px', border: '1px solid oklch(0.5 0.11 35)' },
  aviso: { fontSize: 12.5, color: '#22402f', background: 'oklch(0.97 0.03 150)', padding: '8px 10px', border: '1px solid oklch(0.5 0.09 150)' },
  nota: { fontSize: 11, color: '#8b8578', lineHeight: 1.5, margin: 0 },
}
