import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface Parametros {
  empresa_nombre: string
  comision_subasta: number
  margen_deseado: number
  dias_atribucion_referido: number
}

export const PARAMETROS_DEFAULT: Parametros = {
  empresa_nombre: 'ERP Vehículos',
  comision_subasta: 5000,
  margen_deseado: 20,
  dias_atribucion_referido: 15,
}

let cache: Parametros | null = null
const oyentes = new Set<(p: Parametros) => void>()

function convertir(filas: { clave: string; valor: string }[]): Parametros {
  const p = { ...PARAMETROS_DEFAULT }
  for (const { clave, valor } of filas) {
    if (clave === 'empresa_nombre') p.empresa_nombre = valor
    else if (clave in p) {
      const n = Number(valor)
      if (Number.isFinite(n)) (p as unknown as Record<string, number>)[clave] = n
    }
  }
  return p
}

export async function recargarParametros() {
  if (!supabase) return
  const { data } = await supabase.from('parametro').select('clave, valor')
  cache = convertir((data ?? []) as { clave: string; valor: string }[])
  oyentes.forEach((f) => f(cache!))
}

/** Parámetros del negocio (tabla parametro), compartidos y cacheados entre pantallas. */
export function useParametros(): Parametros {
  const [p, setP] = useState<Parametros>(cache ?? PARAMETROS_DEFAULT)
  useEffect(() => {
    oyentes.add(setP)
    if (!cache) recargarParametros()
    return () => { oyentes.delete(setP) }
  }, [])
  return p
}
