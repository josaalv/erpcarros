import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { supabase, hasSupabase } from '../lib/supabase'
import { ROL_LABEL } from '../lib/helpers'
import type { PerfilPublico } from '../types'
import { Campo, Alerta } from '../components/Ui'

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
      <div className="login-pagina">
        <div className="login-tarjeta">
          <Alerta>Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.</Alerta>
        </div>
      </div>
    )
  }

  const volver = (texto: string, accion: () => void) => (
    <button type="button" className="btn-link" style={{ padding: 0, marginBottom: 18, color: 'var(--text-soft)' }} onClick={accion}>← {texto}</button>
  )

  return (
    <div className="login-pagina">
      <div className="login-tarjeta">
        <div className="login-marca"><span>EV</span> ERP Vehículos</div>

        {paso === 'reset' && (
          <>
            <h1 style={{ fontSize: 24, marginBottom: 16 }}>Nueva contraseña</h1>
            {resetOk ? (
              <div className="form">
                <Alerta tipo="ok">Contraseña actualizada. Ya puedes seguir usando el sistema.</Alerta>
                <button className="btn btn-primario" onClick={() => { setResetOk(false); clearPasswordRecovery(); setPaso('picker') }}>Continuar</button>
              </div>
            ) : (
              <form onSubmit={confirmarNuevaPassword} className="form">
                <Campo label="Nueva contraseña">
                  <input className="input" type="password" value={resetPassword} onChange={(e) => { setResetPassword(e.target.value); setError(null) }} required minLength={6} autoFocus autoComplete="new-password" />
                </Campo>
                <Campo label="Confirmar contraseña">
                  <input className="input" type="password" value={resetConfirmar} onChange={(e) => { setResetConfirmar(e.target.value); setError(null) }} required minLength={6} autoComplete="new-password" />
                </Campo>
                {error && <Alerta>{error}</Alerta>}
                <button className="btn btn-primario" type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar contraseña'}</button>
              </form>
            )}
          </>
        )}

        {paso === 'forgot' && (
          <>
            {volver('Volver', () => { setPaso('picker'); setForgotCorreo(''); setForgotEnviado(false); setError(null) })}
            <h1 style={{ fontSize: 24, marginBottom: 8 }}>Recuperar contraseña</h1>
            {forgotEnviado ? (
              <Alerta tipo="ok">Revisa tu correo. Si está registrado, recibirás un enlace en unos minutos.</Alerta>
            ) : (
              <form onSubmit={pedirRecuperacion} className="form">
                <p className="texto-suave" style={{ margin: 0 }}>Te enviaremos un enlace para crear una contraseña nueva.</p>
                <Campo label="Correo electrónico">
                  <input className="input" type="email" value={forgotCorreo} onChange={(e) => { setForgotCorreo(e.target.value); setError(null) }} required autoFocus />
                </Campo>
                {error && <Alerta>{error}</Alerta>}
                <button className="btn btn-primario" type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar enlace'}</button>
              </form>
            )}
          </>
        )}

        {paso === 'picker' && (
          <>
            <h1 style={{ fontSize: 24 }}>¿Quién eres?</h1>
            <p className="texto-suave" style={{ margin: '4px 0 0' }}>Elige tu perfil para entrar.</p>
            {aviso && <div style={{ marginTop: 14 }}><Alerta tipo="ok">{aviso}</Alerta></div>}

            {cargandoPerfiles ? (
              <div className="cargando">Cargando perfiles…</div>
            ) : errorCarga ? (
              <div style={{ marginTop: 16 }}>
                <Alerta>{errorCarga}</Alerta>
                <button type="button" className="btn btn-secundario" style={{ marginTop: 10 }} onClick={cargarPerfiles}>Reintentar</button>
              </div>
            ) : (
              <div className="perfiles">
                {perfiles.map((p) => (
                  <button key={p.id} type="button" onClick={() => elegirPerfil(p)} className="perfil-card">
                    <div className="avatar">{p.nombre.charAt(0).toUpperCase()}</div>
                    <div style={{ fontWeight: 600 }}>{p.nombre.split(' ')[0]}</div>
                    <div className="texto-muted" style={{ fontSize: 12.5 }}>{ROL_LABEL[p.rol]}</div>
                  </button>
                ))}
                {perfiles.length === 0 && <p className="texto-suave">Todavía no hay cuentas activas.</p>}
              </div>
            )}

            <button type="button" className="btn-link" style={{ marginTop: 10 }} onClick={() => { setPaso('registro'); setError(null); setAviso(null) }}>
              ¿No tienes cuenta? Regístrate
            </button>
          </>
        )}

        {paso === 'password' && seleccionado && (
          <>
            {volver('Cambiar de perfil', () => { setPaso('picker'); setSeleccionado(null) })}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div className="avatar" style={{ width: 50, height: 50, fontSize: 19 }}>{seleccionado.nombre.charAt(0).toUpperCase()}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{seleccionado.nombre}</div>
                <div className="texto-muted">{ROL_LABEL[seleccionado.rol]}</div>
              </div>
            </div>
            <form onSubmit={entrar} className="form">
              <Campo label="Contraseña">
                <input ref={passRef} className="input" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null) }} required disabled={enviando} autoComplete="current-password" />
              </Campo>
              {error && <Alerta>{error}</Alerta>}
              <button className="btn btn-primario" type="submit" disabled={enviando}>{enviando ? 'Verificando…' : 'Entrar'}</button>
              <button type="button" className="btn-link" onClick={() => { setPaso('forgot'); setForgotCorreo(seleccionado.correo); setError(null) }}>
                ¿Olvidaste tu contraseña?
              </button>
            </form>
          </>
        )}

        {paso === 'registro' && (
          <>
            {volver('Volver', () => { setPaso('picker'); setError(null); setAviso(null) })}
            <h1 style={{ fontSize: 24, marginBottom: 16 }}>Crear cuenta</h1>
            <form onSubmit={registrar} className="form">
              <Campo label="Nombre"><input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus /></Campo>
              <Campo label="Correo electrónico"><input className="input" type="email" value={correoRegistro} onChange={(e) => setCorreoRegistro(e.target.value)} required /></Campo>
              <Campo label="Contraseña" ayuda="Mínimo 6 caracteres">
                <input className="input" type="password" value={passwordRegistro} onChange={(e) => setPasswordRegistro(e.target.value)} required minLength={6} autoComplete="new-password" />
              </Campo>
              {error && <Alerta>{error}</Alerta>}
              <button className="btn btn-primario" type="submit" disabled={enviando}>{enviando ? 'Un momento…' : 'Registrarme'}</button>
              <p className="texto-muted" style={{ margin: 0 }}>
                La primera persona que se registra queda como administrador. Las siguientes entran como Gerencia y el administrador puede cambiar su rol.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
