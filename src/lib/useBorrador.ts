import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

/**
 * Guarda el estado de un formulario en localStorage mientras se llena, para
 * que no se pierda si el navegador descarta la pestaña en segundo plano (o
 * simplemente si el usuario se tarda) antes de guardar — clave debe ser
 * única por formulario/instancia (ej. incluir el id del registro, si
 * aplica). Se limpia solo cuando el código que la usa llama la función que
 * regresa (típicamente al guardar con éxito).
 */
export function useBorrador<T>(clave: string, inicial: T): [T, Dispatch<SetStateAction<T>>, () => void] {
  const claveRef = useRef(clave)
  claveRef.current = clave

  const [valor, setValor] = useState<T>(() => {
    try {
      const guardado = window.localStorage.getItem(clave)
      if (!guardado) return inicial
      const leido = JSON.parse(guardado) as T
      // Borradores viejos no traen los campos que se agregaron después al
      // formulario: se completan con el valor inicial.
      const esObjeto = (x: unknown) => typeof x === 'object' && x !== null && !Array.isArray(x)
      return esObjeto(inicial) && esObjeto(leido) ? { ...inicial, ...leido } : leido
    } catch {
      return inicial
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(claveRef.current, JSON.stringify(valor))
    } catch {
      // almacenamiento lleno o no disponible (modo privado) — no bloquea el formulario
    }
  }, [valor])

  function limpiar() {
    try { window.localStorage.removeItem(claveRef.current) } catch { /* no disponible */ }
  }

  return [valor, setValor, limpiar]
}
