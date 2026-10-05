import { useState } from 'react'

export interface CampoMasivo {
  clave: string
  label: string
  opciones: { valor: string; label: string }[]
  /** Convierte el valor del select al que se guarda (ej. Number para ids). */
  convertir?: (v: string) => unknown
}

/**
 * Barra que aparece al seleccionar unidades: elige uno o varios campos y los
 * aplica a todas las seleccionadas en una sola actualización.
 */
export function BarraMasiva({ cantidad, campos, ocupado, onAplicar, onLimpiar }: {
  cantidad: number
  campos: CampoMasivo[]
  ocupado: boolean
  onAplicar: (cambios: Record<string, unknown>) => void
  onLimpiar: () => void
}) {
  const [valores, setValores] = useState<Record<string, string>>({})
  if (cantidad === 0) return null
  const elegidos = campos.filter((c) => valores[c.clave])
  return (
    <div className="barra-masiva">
      <strong>{cantidad} {cantidad === 1 ? 'seleccionada' : 'seleccionadas'}</strong>
      {campos.map((c) => (
        <select key={c.clave} className="select select-chico" value={valores[c.clave] ?? ''} disabled={ocupado}
          onChange={(e) => setValores((v) => ({ ...v, [c.clave]: e.target.value }))}>
          <option value="">{c.label}: sin cambio</option>
          {c.opciones.map((o) => <option key={o.valor} value={o.valor}>{c.label}: {o.label}</option>)}
        </select>
      ))}
      <button className="btn btn-primario btn-chico" disabled={ocupado || elegidos.length === 0}
        onClick={() => {
          onAplicar(Object.fromEntries(elegidos.map((c) => [c.clave, c.convertir ? c.convertir(valores[c.clave]) : valores[c.clave]])))
          setValores({})
        }}>
        {ocupado ? 'Aplicando…' : 'Aplicar a seleccionadas'}
      </button>
      <button className="btn-link" onClick={onLimpiar} disabled={ocupado}>Quitar selección</button>
    </div>
  )
}
