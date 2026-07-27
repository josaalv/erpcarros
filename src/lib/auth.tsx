import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Perfil } from '../types'

interface AuthState {
  session: Session | null
  perfil: Perfil | null
  cargando: boolean
  signIn: (correo: string, password: string) => Promise<string | null>
  signUp: (correo: string, password: string, nombre: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setCargando(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setCargando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
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
      options: { data: { nombre } },
    })
    return error ? traducirError(error.message) : null
  }

  async function signOut() {
    await supabase?.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, perfil, cargando, signIn, signUp, signOut }}>
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
