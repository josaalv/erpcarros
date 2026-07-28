import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Perfil } from '../types'

interface AuthState {
  session: Session | null
  perfil: Perfil | null
  cargando: boolean
  passwordRecovery: boolean
  signIn: (correo: string, password: string) => Promise<string | null>
  signUp: (correo: string, password: string, nombre: string) => Promise<string | null>
  signOut: () => Promise<void>
  enviarRecuperacion: (correo: string) => Promise<string | null>
  actualizarPassword: (nuevaPassword: string) => Promise<string | null>
  clearPasswordRecovery: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargando, setCargando] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setCargando(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setCargando(false)
    })

    // Supabase dispara PASSWORD_RECOVERY cuando la persona abre el enlace de
    // "olvidé mi contraseña" desde su correo — deja una sesión válida, pero
    // eso no debe saltarse la pantalla de "pon tu nueva contraseña".
    const { data: sub } = supabase.auth.onAuthStateChange((evento, nuevaSesion) => {
      if (evento === 'PASSWORD_RECOVERY') { setPasswordRecovery(true); return }
      setSession(nuevaSesion)
      if (!nuevaSesion) {
        setPerfil(null)
        setCargando(false)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session) return
    setCargando(true)
    supabase
      .from('perfil')
      .select('id, nombre, rol, activo')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setPerfil(data as Perfil | null)
        setCargando(false)
      })
  }, [session])

  async function signIn(correo: string, password: string) {
    if (!supabase) return 'Supabase no está configurado.'
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password })
    return error ? traducirError(error.message) : null
  }

  async function signUp(correo: string, password: string, nombre: string) {
    if (!supabase) return 'Supabase no está configurado.'
    const { error } = await supabase.auth.signUp({
      email: correo,
      password,
      options: {
        data: { nombre },
        // Sin esto, el link de confirmacion usa el "Site URL" configurado
        // en el dashboard de Supabase (por default localhost:3000) y manda
        // a los usuarios a una pagina rota. window.location.origin +
        // pathname apunta siempre al sitio real desde donde se registraron.
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    })
    return error ? traducirError(error.message) : null
  }

  async function signOut() {
    await supabase?.auth.signOut()
  }

  async function enviarRecuperacion(correo: string) {
    if (!supabase) return 'Supabase no está configurado.'
    const { error } = await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: window.location.origin + window.location.pathname,
    })
    if (!error) return null
    // Supabase limita cuántos correos manda en poco tiempo — no sirve
    // reintentar de inmediato, así que se avisa en vez de invitar a insistir.
    if (error.status === 429 || /rate.?limit/i.test(error.message)) {
      return 'Se enviaron demasiados correos en poco tiempo. Espera unos minutos antes de volver a intentarlo.'
    }
    return traducirError(error.message)
  }

  async function actualizarPassword(nuevaPassword: string) {
    if (!supabase) return 'Supabase no está configurado.'
    const { error } = await supabase.auth.updateUser({ password: nuevaPassword })
    if (!error) return null
    if (/different from the old password|same.?password/i.test(error.message)) {
      return 'La nueva contraseña debe ser diferente de la que ya tenías.'
    }
    return traducirError(error.message)
  }

  function clearPasswordRecovery() {
    setPasswordRecovery(false)
  }

  return (
    <AuthContext.Provider value={{
      session, perfil, cargando, passwordRecovery, signIn, signUp, signOut,
      enviarRecuperacion, actualizarPassword, clearPasswordRecovery,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

function traducirError(mensaje: string): string {
  if (mensaje.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (mensaje.includes('User already registered')) return 'Ya existe una cuenta con ese correo.'
  if (mensaje.includes('Password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.'
  return mensaje
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
