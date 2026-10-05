import { useState } from 'react'

/** Selección de filas por id; solo cuenta las que siguen visibles con los filtros actuales. */
export function useSeleccion(visibles: number[]) {
  const [marcados, setMarcados] = useState<Set<number>>(new Set())
  const seleccion = visibles.filter((id) => marcados.has(id))
  const todos = visibles.length > 0 && seleccion.length === visibles.length
  return {
    seleccion,
    todos,
    marcado: (id: number) => marcados.has(id),
    alternar: (id: number) => setMarcados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n }),
    alternarTodos: () => setMarcados(todos ? new Set() : new Set(visibles)),
    limpiar: () => setMarcados(new Set()),
  }
}
