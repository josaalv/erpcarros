import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { supabase, hasSupabase } from '../lib/supabase'
import { ROL_LABEL } from '../lib/helpers'
import type { PerfilPublico } from '../types'

type Paso = 'picker' | 'password' | 'registro' | 'forgot' | 'reset'

export default function Login() {
  const { signIn, signUp, passwordRecovery, clearPasswordRecovery, enviarRecuperacion, actualizarPassword } = useAuth()

  const [paso, setPaso] = useState<Paso>('picker')
  const [perfiles, setPerfiles] = useState<PerfilPublico[]>([])
  const [cargandoPerfiles, setCargandoPerfiles] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [seleccionado, setSeleccionado] = useState<PerfilPublico | null>(null)

  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const passRef = useRef<HTMLInputElement>(null)

  const [nombre, setNombre] = useState('')
  const [correoRegistro, setCorreoRegistro] = useState('')
  const [passwordRegistro, setPasswordRegistro] = useState('')

  const [forgotCorreo, setForgotCorreo] = useState('')
  const [forgotEnviado, setForgotEnviado] = useState(false)

  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirmar, setResetConfirmar] = useState('')
  const [resetOk, setResetOk] = useState(false)

  useEffect(() => {
    if (passwordRecovery) setPaso('reset')
  }, [passwordRecovery])

  function cargarPerfiles() {
    if (!supabase) { setCargandoPerfiles(false); return }
    setCargandoPerfiles(true)
    setErrorCarga(null)
    supabase.rpc('listar_perfiles_publicos').then(({ data, error }) => {
      if (error) setErrorCarga('No se pudo conectar con el servidor. Intenta de nuevo.')
      setPerfiles((data ?? []) as PerfilPublico[])
      setCargandoPerfiles(false)
    })
  }

  useEffect(() => { cargarPerfiles() }, [])

  useEffect(() => {
    if (paso === 'password' && seleccionado) {
      setPassword(''); setError('')
      setTimeout(() => passRef.current?.focus(), 80)
    }
  }, [paso, seleccionado])

  function elegirPerfil(p: PerfilPublico) {
    setSeleccionado(p)
    setPaso('password')
  }

  async function entrar(e: FormEvent) {
    e.preventDefault()
    if (!seleccionado) return
    setEnviando(true)
    setError(null)
    const resultado = await signIn(seleccionado.correo, password)
    setEnviando(false)
    if (resultado) setError(resultado)
  }

  async function registrar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    setAviso(null)
    const resultado = await signUp(correoRegistro, passwordRegistro, nombre)
    setEnviando(false)
    if (resultado) { setError(resultado); return }
    setAviso('Cuenta creada. Si el proyecto pide confirmar correo, revisa tu bandeja; si no, ya puedes entrar.')
    setNombre(''); setCorreoRegistro(''); setPasswordRegistro('')
    cargarPerfiles()
    setPaso('picker')
  }

  async function pedirRecuperacion(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    const resultado = await enviarRecuperacion(forgotCorreo)
    setEnviando(false)
    if (resultado) { setError(resultado); return }
    setForgotEnviado(true)
  }

  async function confirmarNuevaPassword(e: FormEvent) {
    e.preventDefault()
    if (resetPassword.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (resetPassword !== resetConfirmar) { setError('Las contraseñas no coinciden.'); return }
    setEnviando(true)
    setError(null)
    const resultado = await actualizarPassword(resetPassword)
    setEnviando(false)
    if (resultado) { setError(resultado); return }
    setResetOk(true)
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
      <div style={estilos.tarjeta}>
        <div style={estilos.marca}>ERP Vehículos</div>

        {paso === 'reset' && (
          <>
            <h1 style={estilos.titulo}>Nueva contraseña</h1>
            {resetOk ? (
              <>
                <div style={estilos.aviso}>Contraseña actualizada. Ya puedes seguir usando el sistema.</div>
                <button
                  style={{ ...estilos.boton, marginTop: 6 }}
                  onClick={() => { setResetOk(false); clearPasswordRecovery(); setPaso('picker') }}
                >
                  Continuar
                </button>
              </>
            ) : (
              <form onSubmit={confirmarNuevaPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={estilos.campo}>
                  Nueva contraseña
                  <input style={estilos.input} type="password" value={resetPassword} onChange={(e) => { setResetPassword(e.target.value); setError(null) }} required minLength={6} autoFocus />
                </label>
                <label style={estilos.campo}>
                  Confirmar contraseña
                  <input style={estilos.input} type="password" value={resetConfirmar} onChange={(e) => { setResetConfirmar(e.target.value); setError(null) }} required minLength={6} />
                </label>
                {error && <div style={estilos.error}>{error}</div>}
                <button style={estilos.boton} type="submit" disabled={enviando}>
                  {enviando ? 'Guardando…' : 'Guardar contraseña'}
                </button>
              </form>
            )}
          </>
        )}

        {paso === 'forgot' && (
          <>
            <button type="button" style={estilos.volver} onClick={() => { setPaso('picker'); setForgotCorreo(''); setForgotEnviado(false); setError(null) }}>
              ← Volver
            </button>
            <h1 style={estilos.titulo}>Recuperar contraseña</h1>
            {forgotEnviado ? (
              <div style={estilos.aviso}>Revisa tu correo. Si el email está registrado, recibirás un enlace en breve.</div>
            ) : (
              <form onSubmit={pedirRecuperacion} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontSize: 12.5, color: '#8b8578', margin: 0 }}>Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.</p>
                <label style={estilos.campo}>
                  Correo electrónico
                  <input style={estilos.input} type="email" value={forgotCorreo} onChange={(e) => { setForgotCorreo(e.target.value); setError(null) }} required autoFocus />
                </label>
                {error && <div style={estilos.error}>{error}</div>}
                <button style={estilos.boton} type="submit" disabled={enviando}>
                  {enviando ? 'Enviando…' : 'Enviar enlace'}
                </button>
              </form>
            )}
          </>
        )}

        {paso === 'picker' && (
          <>
            <h1 style={estilos.titulo}>¿Quién eres?</h1>
            <p style={{ fontSize: 12.5, color: '#8b8578', margin: '0 0 16px' }}>Selecciona tu perfil para entrar.</p>

            {cargandoPerfiles ? (
              <p style={{ fontSize: 13, color: '#8b8578' }}>Cargando perfiles…</p>
            ) : errorCarga ? (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={estilos.error}>{errorCarga}</div>
                <button type="button" style={{ ...estilos.enlace, marginTop: 8 }} onClick={cargarPerfiles}>Reintentar</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: 8 }}>
                {perfiles.map((p) => (
                  <button key={p.id} type="button" onClick={() => elegirPerfil(p)} style={estilos.perfilCard}>
                    <div style={estilos.avatar}>{p.nombre.charAt(0).toUpperCase()}</div>
                    <div style={{ fontWeight: 500, fontSize: 12.5 }}>{p.nombre.split(' ')[0]}</div>
                    <div style={{ fontSize: 10.5, color: '#8b8578' }}>{ROL_LABEL[p.rol]}</div>
                  </button>
                ))}
                {perfiles.length === 0 && <p style={{ fontSize: 12.5, color: '#8b8578' }}>Sin cuentas activas todavía.</p>}
              </div>
            )}

            <button type="button" style={estilos.enlace} onClick={() => { setPaso('registro'); setError(null); setAviso(null) }}>
              ¿No tienes cuenta? Regístrate
            </button>
          </>
        )}

        {paso === 'password' && seleccionado && (
          <>
            <button type="button" style={estilos.volver} onClick={() => { setPaso('picker'); setSeleccionado(null) }}>
              ← Cambiar perfil
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ ...estilos.avatar, width: 46, height: 46, fontSize: 17 }}>{seleccionado.nombre.charAt(0).toUpperCase()}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{seleccionado.nombre}</div>
                <div style={{ fontSize: 11.5, color: '#8b8578' }}>{ROL_LABEL[seleccionado.rol]}</div>
              </div>
            </div>
            <form onSubmit={entrar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={estilos.campo}>
                Contraseña
                <input ref={passRef} style={estilos.input} type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null) }} required disabled={enviando} />
              </label>
              {error && <div style={estilos.error}>{error}</div>}
              <button style={estilos.boton} type="submit" disabled={enviando}>
                {enviando ? 'Verificando…' : 'Entrar'}
              </button>
              <button type="button" style={estilos.enlace} onClick={() => { setPaso('forgot'); setForgotCorreo(seleccionado.correo); setError(null) }}>
                ¿Olvidaste tu contraseña?
              </button>
            </form>
          </>
        )}

        {paso === 'registro' && (
          <>
            <button type="button" style={estilos.volver} onClick={() => { setPaso('picker'); setError(null); setAviso(null) }}>
              ← Volver
            </button>
            <h1 style={estilos.titulo}>Crear cuenta</h1>
            <form onSubmit={registrar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={estilos.campo}>
                Nombre
                <input style={estilos.input} value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </label>
              <label style={estilos.campo}>
                Correo electrónico
                <input style={estilos.input} type="email" value={correoRegistro} onChange={(e) => setCorreoRegistro(e.target.value)} required />
              </label>
              <label style={estilos.campo}>
                Contraseña
                <input style={estilos.input} type="password" value={passwordRegistro} onChange={(e) => setPasswordRegistro(e.target.value)} required minLength={6} />
              </label>
              {error && <div style={estilos.error}>{error}</div>}
              {aviso && <div style={estilos.aviso}>{aviso}</div>}
              <button style={estilos.boton} type="submit" disabled={enviando}>
                {enviando ? 'Un momento…' : 'Registrarme'}
              </button>
              <p style={{ fontSize: 11, color: '#8b8578', lineHeight: 1.5, margin: 0 }}>
                La primera persona que se registra en el sistema se vuelve administrador automáticamente.
                Las siguientes entran como Gerencia; el administrador puede cambiar su rol después.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

const estilos: Record<string, React.CSSProperties> = {
  pagina: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#f7f5f0', fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
  },
  tarjeta: {
    width: 400, background: '#fff', border: '1px solid #e4e0d8', padding: '32px 28px',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  marca: {
    font: '600 10px/1 "IBM Plex Mono", monospace', letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'oklch(0.45 0.09 215)', marginBottom: 14,
  },
  titulo: { font: '400 24px/1.2 Georgia, serif', color: '#1c1b19', margin: '0 0 6px' },
  campo: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: '#55524b' },
  input: { padding: '9px 10px', border: '1px solid #ddd8d0', fontSize: 14, fontFamily: 'inherit' },
  boton: {
    marginTop: 2, padding: '11px', background: '#26302f', color: '#f3f1ec', border: 'none',
    fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  enlace: { background: 'none', border: 'none', color: 'oklch(0.45 0.09 215)', fontSize: 12.5, cursor: 'pointer', padding: '10px 0 0', textAlign: 'center' },
  volver: { background: 'none', border: 'none', color: '#8b8578', fontSize: 12, cursor: 'pointer', padding: 0, textAlign: 'left', marginBottom: 18 },
  error: { fontSize: 12.5, color: 'oklch(0.48 0.13 32)', background: 'oklch(0.97 0.025 32)', padding: '8px 10px', border: '1px solid oklch(0.5 0.11 35)' },
  aviso: { fontSize: 12.5, color: '#22402f', background: 'oklch(0.97 0.03 150)', padding: '8px 10px', border: '1px solid oklch(0.5 0.09 150)' },
  perfilCard: {
    background: '#faf9f6', border: '1px solid #e4e0d8', padding: '14px 10px', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontFamily: 'inherit',
  },
  avatar: {
    width: 40, height: 40, borderRadius: '50%', background: '#26302f', color: '#f3f1ec',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
    font: '500 15px Georgia, serif',
  },
}
