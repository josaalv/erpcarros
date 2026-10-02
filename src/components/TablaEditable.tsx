import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { Modal, FormBotones, Campo, Alerta, Cargando, Badge } from './Ui'

export interface CampoDef {
  clave: string
  label: string
  tipo?: 'texto' | 'numero' | 'si_no' | 'opciones' | 'textarea' | 'correo'
  opciones?: { valor: string; label: string }[]
  requerido?: boolean
  enTabla?: boolean
  ayuda?: string
  valorInicial?: string | boolean
}

type Fila = Record<string, unknown> & { id: number | string }

/** Clave estable a partir del nombre: NFD + quitar marcas combinantes U+0300-U+036F. */
function claveDesde(nombre: string) {
  return nombre.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') + '_' + Date.now().toString().slice(-5)
}

function mostrar(campo: CampoDef, valor: unknown): ReactNode {
  if (campo.tipo === 'si_no') return valor ? <Badge tono="ok">Sí</Badge> : <Badge>No</Badge>
  if (valor === null || valor === undefined || valor === '') return <span className="texto-muted">—</span>
  if (campo.tipo === 'opciones') return campo.opciones?.find((o) => o.valor === String(valor))?.label ?? String(valor)
  return String(valor)
}

/**
 * Alta, edición y borrado de una tabla simple. El borrado se apoya en el FK:
 * si el registro ya se usa en otro lado, Postgres lo rechaza y se sugiere
 * desactivarlo en su lugar.
 */
export function TablaEditable({ tabla, titulo, descripcion, campos, orden = 'nombre', generarClave = false, protegidas = [], textoNuevo = 'Agregar' }: {
  tabla: string
  titulo: string
  descripcion?: string
  campos: CampoDef[]
  orden?: string
  generarClave?: boolean
  protegidas?: string[]
  textoNuevo?: string
}) {
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState<Fila | 'nueva' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function recargar() {
    if (!supabase) return
    const { data, error } = await supabase.from(tabla).select('*').order(orden)
    if (error) setError(error.message)
    setFilas((data ?? []) as Fila[])
    setCargando(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { recargar() }, [tabla])

  async function eliminar(f: Fila) {
    const nombre = String(f.nombre ?? f.id)
    if (!supabase || !window.confirm(`¿Eliminar "${nombre}"?`)) return
    setError(null)
    const { error } = await supabase.from(tabla).delete().eq('id', f.id)
    if (error) {
      setError(error.code === '23503'
        ? `"${nombre}" ya está en uso en otros registros y no se puede eliminar. Puedes desactivarlo.`
        : error.message)
      return
    }
    recargar()
  }

  const enTabla = campos.filter((c) => c.enTabla !== false)
  const protegida = (f: Fila) => typeof f.clave === 'string' && protegidas.includes(f.clave)

  return (
    <section className="seccion">
      <div className="seccion-header">
        <div>
          <h2>{titulo}</h2>
          {descripcion && <p>{descripcion}</p>}
        </div>
        <button className="btn btn-primario" onClick={() => setEditando('nueva')}>+ {textoNuevo}</button>
      </div>
      {error && <div style={{ marginBottom: 12 }}><Alerta>{error}</Alerta></div>}
      {cargando ? <Cargando /> : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                {enTabla.map((c) => <th key={c.clave} className={c.tipo === 'numero' ? 'num' : undefined}>{c.label}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={String(f.id)} className={f.activo === false ? 'inactivo' : ''}>
                  {enTabla.map((c, i) => (
                    <td key={c.clave} className={c.tipo === 'numero' ? 'num' : undefined} style={i === 0 ? { fontWeight: 600 } : undefined}>
                      {mostrar(c, f[c.clave])}
                    </td>
                  ))}
                  <td className="acciones-celda">
                    <button className="btn-link" onClick={() => setEditando(f)}>Editar</button>
                    {protegida(f)
                      ? <span className="texto-muted" title="El sistema usa este registro; se puede renombrar pero no eliminar">Del sistema</span>
                      : <button className="btn-link peligro" onClick={() => eliminar(f)}>Eliminar</button>}
                  </td>
                </tr>
              ))}
              {filas.length === 0 && <tr><td colSpan={enTabla.length + 1} className="vacio">Todavía no hay registros.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <FilaModal
          tabla={tabla}
          titulo={titulo}
          campos={campos}
          fila={editando === 'nueva' ? null : editando}
          generarClave={generarClave}
          onClose={() => setEditando(null)}
          onGuardado={() => { setEditando(null); recargar() }}
        />
      )}
    </section>
  )
}

function FilaModal({ tabla, titulo, campos, fila, generarClave, onClose, onGuardado }: {
  tabla: string
  titulo: string
  campos: CampoDef[]
  fila: Fila | null
  generarClave: boolean
  onClose: () => void
  onGuardado: () => void
}) {
  const [form, setForm] = useState<Record<string, string | boolean>>(() => Object.fromEntries(campos.map((c) => {
    const actual = fila?.[c.clave]
    if (c.tipo === 'si_no') return [c.clave, fila ? Boolean(actual) : (c.valorInicial ?? true)]
    return [c.clave, actual !== null && actual !== undefined ? String(actual) : String(c.valorInicial ?? '')]
  })))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    const datos: Record<string, unknown> = {}
    for (const c of campos) {
      const v = form[c.clave]
      if (c.tipo === 'si_no') datos[c.clave] = Boolean(v)
      else if (c.tipo === 'numero') datos[c.clave] = String(v).trim() === '' ? null : Number(v)
      else datos[c.clave] = String(v).trim() === '' ? null : String(v).trim()
    }
    if (!fila && generarClave) datos.clave = claveDesde(String(form.nombre ?? ''))
    const { error } = fila
      ? await supabase.from(tabla).update(datos).eq('id', fila.id)
      : await supabase.from(tabla).insert(datos)
    setGuardando(false)
    if (error) { setError(error.code === '23505' ? 'Ya existe un registro con esos datos.' : error.message); return }
    onGuardado()
  }

  return (
    <Modal titulo={`${fila ? 'Editar' : 'Agregar'} · ${titulo}`} onClose={onClose} ancho={520}>
      <form onSubmit={onSubmit} className="form">
        {campos.map((c) => {
          const set = (v: string | boolean) => setForm((f) => ({ ...f, [c.clave]: v }))
          if (c.tipo === 'si_no') {
            return (
              <label key={c.clave} className="check">
                <input type="checkbox" checked={Boolean(form[c.clave])} onChange={(e) => set(e.target.checked)} />
                {c.label}{c.ayuda && <span className="texto-muted"> · {c.ayuda}</span>}
              </label>
            )
          }
          return (
            <Campo key={c.clave} label={c.label} ayuda={c.ayuda}>
              {c.tipo === 'opciones' ? (
                <select className="select" required={c.requerido} value={String(form[c.clave])} onChange={(e) => set(e.target.value)}>
                  {!c.requerido && <option value="">—</option>}
                  {c.opciones?.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
                </select>
              ) : c.tipo === 'textarea' ? (
                <textarea className="textarea" rows={3} value={String(form[c.clave])} onChange={(e) => set(e.target.value)} />
              ) : (
                <input
                  className="input"
                  type={c.tipo === 'numero' ? 'number' : c.tipo === 'correo' ? 'email' : 'text'}
                  step={c.tipo === 'numero' ? 'any' : undefined}
                  required={c.requerido}
                  value={String(form[c.clave])}
                  onChange={(e) => set(e.target.value)}
                />
              )}
            </Campo>
          )
        })}
        {error && <Alerta>{error}</Alerta>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}
