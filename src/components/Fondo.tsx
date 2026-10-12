import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useBorrador } from '../lib/useBorrador'
import { fecha, hoyISO, mxn } from '../lib/helpers'
import { TIPO_MOVIMIENTO, retiroMaximo } from '../lib/fondo'
import { ORIGEN_LABEL } from '../lib/propiedad'
import { Alerta, Campo, Cargando, FormBotones, Modal } from './Ui'
import type { Aportacion, CuentaSocio, MovimientoFondo, MovimientoSocio, PrestamoSocio, Socio, TipoMovimientoFondo } from '../types'

/** Lo mínimo de una unidad que necesitan los selectores de estos formularios. */
export interface UnidadOpcion { id: number; id_interno: string; marca: string; modelo: string; anio: number; estado_comercial?: string }

const nombreUnidad = (u?: UnidadOpcion) => (u ? `${u.id_interno} · ${u.marca} ${u.modelo} ${u.anio}` : '—')

async function cargarCuentas(): Promise<CuentaSocio[]> {
  const { data } = await supabase!.from('v_cuenta_socio').select('*')
  return (data ?? []) as CuentaSocio[]
}

/* ── Aportación a la compra de una unidad ──────────────────────────── */

/**
 * Lo que un socio puso para comprar una unidad, del fondo o de su bolsa. Si
 * lo toma del fondo y no le alcanza, propone registrar un préstamo de otro
 * socio por la diferencia (sin interés; se paga al vender la unidad).
 */
export function AportacionCompraModal({ aportacion, socios, unidades, vehiculoId, onClose, onGuardado }: {
  aportacion: Aportacion | null
  socios: Socio[]
  /** Si no se da vehiculoId, se elige la unidad de esta lista. */
  unidades?: UnidadOpcion[]
  vehiculoId?: number
  onClose: () => void
  onGuardado: () => void
}) {
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:aportacion:${vehiculoId ?? 'x'}:${aportacion?.id ?? 'nueva'}`, {
    socioId: aportacion ? String(aportacion.socio_id) : '',
    vehiculoId: aportacion ? String(aportacion.vehiculo_id) : vehiculoId ? String(vehiculoId) : '',
    monto: aportacion ? String(aportacion.monto) : '',
    fecha: aportacion?.fecha ?? hoyISO(),
    origen: (aportacion?.origen ?? 'fondo') as Aportacion['origen'],
    prestamistaId: '',
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const [cuentas, setCuentas] = useState<CuentaSocio[] | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { cargarCuentas().then(setCuentas) }, [])

  const cuenta = cuentas?.find((c) => String(c.socio_id) === form.socioId)
  // Al editar, lo que ya estaba tomado del fondo vuelve a estar disponible.
  const yaTomado = aportacion && aportacion.origen === 'fondo' && String(aportacion.socio_id) === form.socioId ? aportacion.monto : 0
  const disponible = cuenta ? cuenta.liquido + yaTomado : 0
  const falta = form.origen === 'fondo' && cuenta && Number(form.monto) > 0 ? Math.max(0, Number(form.monto) - disponible) : 0
  const prestamistas = (cuentas ?? []).filter((c) => String(c.socio_id) !== form.socioId && c.activo)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    if (falta > 0 && !form.prestamistaId) { setError('Elige quién le presta la diferencia, o cambia el origen a "De su bolsa".'); return }
    setGuardando(true)
    setError(null)
    const datos = { socio_id: Number(form.socioId), vehiculo_id: Number(form.vehiculoId), monto: Number(form.monto), fecha: form.fecha, origen: form.origen }
    const { error: err } = aportacion
      ? await supabase.from('aportacion').update(datos).eq('id', aportacion.id)
      : await supabase.from('aportacion').insert(datos)
    if (err) { setGuardando(false); setError(err.message); return }
    if (falta > 0) {
      const { error: errP } = await supabase.from('prestamo_socio').insert({
        prestamista_id: Number(form.prestamistaId), deudor_id: Number(form.socioId), vehiculo_id: Number(form.vehiculoId),
        monto: Math.round(falta * 100) / 100, fecha: form.fecha, nota: 'Para completar su parte de la compra',
      })
      if (errP) { setGuardando(false); setError(`La aportación se guardó, pero no el préstamo: ${errP.message}`); return }
    }
    setGuardando(false)
    limpiarBorrador()
    onGuardado()
  }

  const opciones = (unidades ?? []).filter((u) => u.estado_comercial !== 'vendido' || String(u.id) === form.vehiculoId)

  return (
    <Modal titulo={aportacion ? 'Editar aportación a la compra' : 'Aportación a la compra'} onClose={onClose}>
      <form onSubmit={onSubmit} className="form">
        <Campo label="Socio">
          <select className="select" required value={form.socioId} onChange={(e) => set('socioId', e.target.value)}>
            <option value="">Elige un socio…</option>
            {socios.filter((s) => s.activo || String(s.id) === form.socioId).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </Campo>
        {!vehiculoId && (
          <Campo label="Unidad">
            <select className="select" required value={form.vehiculoId} onChange={(e) => set('vehiculoId', e.target.value)}>
              <option value="">Elige una unidad…</option>
              {opciones.map((u) => <option key={u.id} value={u.id}>{nombreUnidad(u)}</option>)}
            </select>
          </Campo>
        )}
        <div className="form-grid">
          <Campo label="Monto"><input className="input" required type="number" step="0.01" min={0} value={form.monto} onChange={(e) => set('monto', e.target.value)} /></Campo>
          <Campo label="Fecha"><input className="input" required type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} /></Campo>
          <Campo label="¿Con qué dinero?" ayuda={cuenta && form.origen === 'fondo' ? `Tiene ${mxn(disponible)} disponibles en el fondo.` : undefined}>
            <select className="select" value={form.origen} onChange={(e) => set('origen', e.target.value)}>
              <option value="fondo">{ORIGEN_LABEL.fondo}</option>
              <option value="bolsa">{ORIGEN_LABEL.bolsa}</option>
            </select>
          </Campo>
        </div>
        {falta > 0 && (
          <>
            <Alerta tipo="aviso">
              Del fondo solo le alcanza {mxn(disponible)}: le faltan <strong>{mxn(falta)}</strong>. Se registrará como préstamo
              sin interés de otro socio, que se paga al vender la unidad (quien presta no recibe utilidad).
            </Alerta>
            <Campo label="¿Quién le presta?">
              <select className="select" value={form.prestamistaId} onChange={(e) => set('prestamistaId', e.target.value)}>
                <option value="">Elige quién presta…</option>
                {prestamistas.map((c) => (
                  <option key={c.socio_id} value={c.socio_id}>{c.nombre} · {mxn(c.liquido)} disponibles{c.liquido < falta ? ' (no le alcanza)' : ''}</option>
                ))}
              </select>
            </Campo>
          </>
        )}
        {error && <Alerta>{error}</Alerta>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}

/* ── Movimientos directos del fondo ────────────────────────────────── */

export function MovimientoModal({ movimiento, socioId, socios, onClose, onGuardado }: {
  movimiento: MovimientoFondo | null
  socioId?: number
  socios: Socio[]
  onClose: () => void
  onGuardado: () => void
}) {
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:movimiento:${movimiento?.id ?? 'nuevo'}`, {
    socioId: movimiento ? String(movimiento.socio_id) : socioId ? String(socioId) : '',
    tipo: (movimiento?.tipo ?? 'aporte') as TipoMovimientoFondo,
    monto: movimiento ? String(movimiento.monto) : '',
    fecha: movimiento?.fecha ?? hoyISO(),
    origenDinero: movimiento?.origen_dinero ?? '',
    nota: movimiento?.nota ?? '',
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const [cuentas, setCuentas] = useState<CuentaSocio[] | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { cargarCuentas().then(setCuentas) }, [])

  const cuenta = cuentas?.find((c) => String(c.socio_id) === form.socioId)
  // Al editar un retiro, su monto vuelve a estar disponible para el cálculo.
  const maximo = cuenta && cuentas
    ? retiroMaximo({ ...cuenta, liquido: cuenta.liquido + (movimiento?.tipo === 'retiro' ? movimiento.monto : 0) }, cuentas)
    : null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    const monto = Number(form.monto)
    if (form.tipo === 'retiro' && maximo !== null && monto > maximo + 0.001) {
      setError(`Lo más que puede retirar es ${mxn(maximo)} (su proporción del fondo líquido).`)
      return
    }
    setGuardando(true)
    setError(null)
    const datos = {
      socio_id: Number(form.socioId), tipo: form.tipo, monto, fecha: form.fecha,
      origen_dinero: form.tipo === 'aporte' || form.tipo === 'saldo_inicial' ? form.origenDinero.trim() || null : null,
      nota: form.nota.trim() || null,
    }
    const { error: err } = movimiento
      ? await supabase.from('movimiento_fondo').update(datos).eq('id', movimiento.id)
      : await supabase.from('movimiento_fondo').insert(datos)
    setGuardando(false)
    if (err) { setError(err.message); return }
    limpiarBorrador()
    onGuardado()
  }

  return (
    <Modal titulo={movimiento ? 'Editar movimiento del fondo' : 'Movimiento del fondo'} onClose={onClose}>
      <form onSubmit={onSubmit} className="form">
        <div className="form-grid">
          <Campo label="Socio">
            <select className="select" required value={form.socioId} onChange={(e) => set('socioId', e.target.value)}>
              <option value="">Elige un socio…</option>
              {socios.filter((s) => s.activo || String(s.id) === form.socioId).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Tipo">
            <select className="select" value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
              {(['saldo_inicial', 'aporte', 'retiro', 'ajuste'] as const).map((t) => <option key={t} value={t}>{TIPO_MOVIMIENTO[t]}</option>)}
            </select>
          </Campo>
          <Campo label="Monto" ayuda={form.tipo === 'ajuste' ? 'Negativo para restar.' : form.tipo === 'retiro' && maximo !== null ? `Máximo ${mxn(maximo)}.` : undefined}>
            <input className="input" required type="number" step="0.01" min={form.tipo === 'ajuste' ? undefined : 0} value={form.monto} onChange={(e) => set('monto', e.target.value)} />
          </Campo>
          <Campo label="Fecha"><input className="input" required type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} /></Campo>
        </div>
        {(form.tipo === 'aporte' || form.tipo === 'saldo_inicial') && (
          <Campo label="¿De dónde viene el dinero?" ayuda="Opcional, solo informativo (p. ej. crédito, venta de otro bien).">
            <input className="input" value={form.origenDinero} onChange={(e) => set('origenDinero', e.target.value)} />
          </Campo>
        )}
        <Campo label="Nota"><input className="input" value={form.nota} onChange={(e) => set('nota', e.target.value)} /></Campo>
        {form.tipo === 'saldo_inicial' && <p className="texto-suave" style={{ margin: 0 }}>Úsalo una vez por socio, con la fecha de corte, para arrancar sin capturar el historial anterior.</p>}
        {error && <Alerta>{error}</Alerta>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}

/* ── Estado de cuenta de un socio ──────────────────────────────────── */

export function EstadoCuentaModal({ socio, unidades, onEditar, onClose, onCambio }: {
  socio: Socio
  unidades: UnidadOpcion[]
  onEditar: (m: MovimientoFondo) => void
  onClose: () => void
  onCambio: () => void
}) {
  const [movs, setMovs] = useState<MovimientoSocio[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    const { data } = await supabase!.from('v_movimiento_socio').select('*').eq('socio_id', socio.id).order('fecha').order('fuente_id')
    setMovs((data ?? []) as MovimientoSocio[])
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar() }, [socio.id])

  async function editar(m: MovimientoSocio) {
    const { data } = await supabase!.from('movimiento_fondo').select('*').eq('id', m.fuente_id).maybeSingle()
    if (data) onEditar(data as MovimientoFondo)
  }

  async function quitar(m: MovimientoSocio) {
    if (!window.confirm(`¿Quitar el movimiento "${TIPO_MOVIMIENTO[m.tipo]}" por ${mxn(m.monto)}?`)) return
    setError(null)
    const { error: err } = await supabase!.from('movimiento_fondo').delete().eq('id', m.fuente_id)
    if (err) { setError(err.message); return }
    await cargar()
    onCambio()
  }

  let saldo = 0
  return (
    <Modal titulo={`Estado de cuenta · ${socio.nombre}`} subtitulo="Saldo = su parte líquida del fondo. Lo pagado de su bolsa no mueve el saldo, pero sí cuenta como capital en la unidad." ancho={900} onClose={onClose}>
      {error && <div style={{ marginBottom: 12 }}><Alerta>{error}</Alerta></div>}
      {movs === null ? <Cargando /> : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Movimiento</th><th>Unidad / detalle</th><th className="num">Monto</th><th className="num">Saldo</th><th></th></tr></thead>
            <tbody>
              {movs.map((m) => {
                saldo += m.efecto
                return (
                  <tr key={`${m.fuente}-${m.fuente_id}-${m.tipo}`}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fecha(m.fecha)}</td>
                    <td>{TIPO_MOVIMIENTO[m.tipo]}</td>
                    <td>
                      {m.vehiculo_id ? nombreUnidad(unidades.find((u) => u.id === m.vehiculo_id)) : ''}
                      {m.detalle && <span className="unidad-folio">{m.detalle}</span>}
                    </td>
                    <td className={`num ${m.efecto < 0 ? 'texto-peligro' : ''}`}>{m.efecto === 0 ? <span className="texto-suave">{mxn(m.monto)}</span> : mxn(m.efecto)}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{mxn(saldo)}</td>
                    <td className="acciones-celda">
                      {m.fuente === 'movimiento_fondo' && <>
                        <button className="btn-link" onClick={() => editar(m)}>Editar</button>
                        <button className="btn-link peligro" onClick={() => quitar(m)}>Quitar</button>
                      </>}
                    </td>
                  </tr>
                )
              })}
              {movs.length === 0 && <tr><td colSpan={6} className="vacio">Sin movimientos todavía. Empieza con su saldo inicial.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

/* ── Préstamos entre socios ────────────────────────────────────────── */

export function PrestamoModal({ prestamo, socios, unidades, onClose, onGuardado }: {
  prestamo: PrestamoSocio | null
  socios: Socio[]
  unidades: UnidadOpcion[]
  onClose: () => void
  onGuardado: () => void
}) {
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:prestamo:${prestamo?.id ?? 'nuevo'}`, {
    prestamistaId: prestamo ? String(prestamo.prestamista_id) : '',
    deudorId: prestamo ? String(prestamo.deudor_id) : '',
    vehiculoId: prestamo?.vehiculo_id ? String(prestamo.vehiculo_id) : '',
    monto: prestamo ? String(prestamo.monto) : '',
    fecha: prestamo?.fecha ?? hoyISO(),
    nota: prestamo?.nota ?? '',
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    if (form.prestamistaId === form.deudorId) { setError('Quien presta y quien recibe deben ser socios distintos.'); return }
    setGuardando(true)
    setError(null)
    const datos = {
      prestamista_id: Number(form.prestamistaId), deudor_id: Number(form.deudorId),
      vehiculo_id: form.vehiculoId ? Number(form.vehiculoId) : null, monto: Number(form.monto), fecha: form.fecha, nota: form.nota.trim() || null,
    }
    const { error: err } = prestamo
      ? await supabase.from('prestamo_socio').update(datos).eq('id', prestamo.id)
      : await supabase.from('prestamo_socio').insert(datos)
    setGuardando(false)
    if (err) { setError(err.message); return }
    limpiarBorrador()
    onGuardado()
  }

  const activos = socios.filter((s) => s.activo || String(s.id) === form.prestamistaId || String(s.id) === form.deudorId)
  return (
    <Modal titulo={prestamo ? 'Editar préstamo' : 'Préstamo entre socios'} subtitulo="Sin interés. Se paga al vender la unidad; quien presta no participa de la utilidad." onClose={onClose}>
      <form onSubmit={onSubmit} className="form">
        <div className="form-grid">
          <Campo label="Presta">
            <select className="select" required value={form.prestamistaId} onChange={(e) => set('prestamistaId', e.target.value)}>
              <option value="">Elige…</option>
              {activos.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Recibe (le debe)">
            <select className="select" required value={form.deudorId} onChange={(e) => set('deudorId', e.target.value)}>
              <option value="">Elige…</option>
              {activos.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Monto"><input className="input" required type="number" step="0.01" min={0} value={form.monto} onChange={(e) => set('monto', e.target.value)} /></Campo>
          <Campo label="Fecha"><input className="input" required type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} /></Campo>
        </div>
        <Campo label="Unidad" ayuda="La unidad por la que se pidió; al venderla se paga.">
          <select className="select" value={form.vehiculoId} onChange={(e) => set('vehiculoId', e.target.value)}>
            <option value="">Sin unidad</option>
            {unidades.filter((u) => u.estado_comercial !== 'vendido' || String(u.id) === form.vehiculoId).map((u) => <option key={u.id} value={u.id}>{nombreUnidad(u)}</option>)}
          </select>
        </Campo>
        <Campo label="Nota"><input className="input" value={form.nota} onChange={(e) => set('nota', e.target.value)} /></Campo>
        {error && <Alerta>{error}</Alerta>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}
