import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { CategoriaGasto, EstadoProceso, Ubicacion } from '../types'

/** Catálogos configurables: se cargan una vez y se comparten entre pantallas. */
export function useCatalogos() {
  const [estados, setEstados] = useState<EstadoProceso[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!supabase) return
    Promise.all([
      supabase.from('estado_proceso').select('*').order('orden'),
      supabase.from('ubicacion').select('*').order('nombre'),
      supabase.from('categoria_gasto').select('*').order('orden'),
    ]).then(([e, u, c]) => {
      setEstados((e.data ?? []) as EstadoProceso[])
      setUbicaciones((u.data ?? []) as Ubicacion[])
      setCategorias((c.data ?? []) as CategoriaGasto[])
      setCargando(false)
    })
  }, [])

  return { estados, ubicaciones, categorias, cargando }
}
