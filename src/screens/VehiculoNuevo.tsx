import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCatalogos } from '../lib/catalogos'
import { useAuth } from '../lib/auth'
import { useBorrador } from '../lib/useBorrador'
import { useParametros } from '../lib/parametros'
import { hoyISO, mxn, porcentaje, fecha, numeroONull, ESTADO_DOCUMENTO } from '../lib/helpers'
import { PageHeader, Campo, Alerta, Cargando, Dato } from '../components/Ui'
import type { Subasta, Socio, TipoDocumento, CategoriaGasto } from '../types'

interface FilaGasto { descripcion: string; categoriaId: string; importe: string; fecha: string }
interface FilaSocio { socioId: string; monto: string }
type EstadoDoc = 'no_aplica' | 'faltante' | 'en_tramite' | 'completo'

interface Formulario {
  paso: number
  id_interno: string; vin: string; marca: string; modelo: string; version: string; anio: string
  kilometraje: string; color: string; transmision: string
  subastaId: string
  nuevaPlataforma: string; nuevaFecha: string; nuevoLote: string; nuevoPatio: string
  torre: string; fecha_compra: string; precio_martillo: string; comision: string
  gastos: FilaGasto[]
  socios: FilaSocio[]
  documentos: Record<string, EstadoDoc>
  precio_autorizado: string; precio_minimo: string
}

const NUEVA = 'nueva'

/**
 * Alta completa de una unidad en un solo asistente. Todo se guarda al final y
 * en orden (subasta nueva → vehiculo → compra → gastos → aportaciones →
 * documentos); si algo falla después de crear el vehículo se borra para no
 * dejar la unidad a medias. Compra, gastos y socios son solo admin (RLS).
 */
export default function VehiculoNuevo() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const esAdmin = perfil?.rol === 'admin'
  const { estados, ubicaciones, categorias, cargando } = useCatalogos()
  const { comision_subasta } = useParametros()
  const [subastas, setSubastas] = useState<Subasta[]>([])
  const [socios, setSocios] = useState<Socio[]>([])
  const [tipos, setTipos] = useState<TipoDocumento[]>([])
  const [cargandoListas, setCargandoListas] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [f, setF, limpiarBorrador] = useBorrador<Formulario>('borrador:alta-unidad', {
    paso: 0,
    id_interno: '', vin: '', marca: '', modelo: '', version: '', anio: String(new Date().getFullYear()),
    kilometraje: '', color: '', transmision: 'automatica',
    subastaId: '', nuevaPlataforma: 'Prosubastas', nuevaFecha: hoyISO(), nuevoLote: '', nuevoPatio: '',
    torre: '', fecha_compra: hoyISO(), precio_martillo: '', comision: String(comision_subasta),
    gastos: [], socios: [], documentos: {},
    precio_autorizado: '', precio_minimo: '',
  })
  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setF((x) => ({ ...x, [k]: v }))

  useEffect(() => {
    if (!supabase) return
    Promise.all([
      supabase.from('subasta').select('*').order('fecha', { ascending: false }),
      supabase.from('socio').select('*').eq('activo', true).order('nombre'),
      supabase.from('tipo_documento').select('*').eq('activo', true).order('orden'),
    ]).then(([s, so, t]) => {
      setSubastas((s.data ?? []) as Subasta[])
      setSocios((so.data ?? []) as Socio[])
      setTipos((t.data ?? []) as TipoDocumento[])
      setCargandoListas(false)
    })
  }, [])

  if (cargando || cargandoListas) return <Cargando />

  const pasos = [
    { titulo: 'Unidad', visible: true },
    { titulo: 'Subasta y compra', visible: esAdmin },
    { titulo: 'Gastos', visible: esAdmin },
    { titulo: 'Socios', visible: esAdmin },
    { titulo: 'Documentos y precio', visible: true },
    { titulo: 'Resumen', visible: true },
  ].map((p, i) => ({ ...p, i })).filter((p) => p.visible)
  const posicion = Math.max(0, pasos.findIndex((p) => p.i === f.paso))
  const pasoActual = pasos[posicion]?.i ?? 0

  // Cálculos que se van actualizando conforme se captura.
  const costoCompra = (Number(f.precio_martillo) || 0) + (Number(f.comision) || 0)
  const totalGastos = f.gastos.reduce((acc, g) => acc + (Number(g.importe) || 0), 0)
  const costoTotal = costoCompra + totalGastos
  const totalAportado = f.socios.reduce((acc, s) => acc + (Number(s.monto) || 0), 0)
  const precioVenta = Number(f.precio_autorizado) || 0
  const utilidad = precioVenta > 0 ? precioVenta - costoTotal : null
  const margen = precioVenta > 0 ? (precioVenta - costoTotal) / precioVenta : null
  const estadoDoc = (t: TipoDocumento): EstadoDoc => f.documentos[t.id] ?? 'faltante'
  const subastaElegida = subastas.find((s) => String(s.id) === f.subastaId)

  function validar(paso: number): string | null {
    if (paso === 0) {
      if (!f.id_interno.trim() || !f.marca.trim() || !f.modelo.trim() || !f.anio) return 'Falta folio, marca, modelo o año.'
    }
    if (paso === 1) {
      if (f.subastaId === NUEVA && (!f.nuevaPlataforma.trim() || !f.nuevaFecha)) return 'Falta plataforma o fecha de la subasta nueva.'
      if (!f.precio_martillo) return 'Falta el precio de martillo.'
    }
    if (paso === 2 && f.gastos.some((g) => !g.descripcion.trim() || !g.categoriaId || !g.importe)) {
      return 'Cada gasto necesita descripción, categoría e importe (o quítalo).'
    }
    if (paso === 3) {
      if (f.socios.some((s) => !s.socioId || !s.monto)) return 'Cada socio necesita nombre y monto (o quítalo).'
      if (new Set(f.socios.map((s) => s.socioId)).size !== f.socios.length) return 'Un socio aparece dos veces; junta sus montos en una sola fila.'
    }
    return null
  }

  function ir(destino: number) {
    if (destino > posicion) {
      for (let k = posicion; k < destino; k++) {
        const e = validar(pasos[k].i)
        if (e) { setError(e); set('paso', pasos[k].i); return }
      }
    }
    setError(null)
    set('paso', pasos[destino].i)
  }

  async function guardar() {
    if (!supabase) return
    for (const p of pasos) {
      const e = validar(p.i)
      if (e) { setError(e); set('paso', p.i); return }
    }
    setGuardando(true)
    setError(null)

    let subastaCreada: number | null = null
    let subastaId: number | null = f.subastaId && f.subastaId !== NUEVA ? Number(f.subastaId) : null
    if (esAdmin && f.subastaId === NUEVA) {
      const { data, error } = await supabase.from('subasta').insert({
        plataforma: f.nuevaPlataforma.trim(), fecha: f.nuevaFecha, lote: f.nuevoLote.trim() || null, patio_origen: f.nuevoPatio.trim() || null,
      }).select('id').single()
      if (error || !data) { setGuardando(false); setError(`No se pudo crear la subasta: ${error?.message}`); return }
      subastaCreada = data.id
      subastaId = data.id
    }

    const aplicables = tipos.filter((t) => estadoDoc(t) !== 'no_aplica')
    const listos = aplicables.filter((t) => estadoDoc(t) === 'completo').length
    const estadoDocumental = aplicables.length > 0 && listos === aplicables.length ? 'completo'
      : aplicables.some((t) => estadoDoc(t) !== 'faltante') ? 'en_tramite' : 'incompleto'

    const { data: veh, error: errVeh } = await supabase.from('vehiculo').insert({
      id_interno: f.id_interno.trim(), vin: f.vin.trim() || null,
      marca: f.marca.trim(), modelo: f.modelo.trim(), version: f.version.trim() || null, anio: Number(f.anio),
      kilometraje: numeroONull(f.kilometraje), color: f.color.trim() || null, transmision: f.transmision,
      estado_proceso_id: (estados.find((x) => x.clave === 'comprado') ?? estados[0])?.id,
      ubicacion_id: (ubicaciones.find((u) => u.clave === 'traslado') ?? ubicaciones[0])?.id,
      fecha_compra: f.fecha_compra || null,
      subasta_id: subastaId, torre: f.torre.trim() || null,
      estado_documental: estadoDocumental,
      precio_autorizado: numeroONull(f.precio_autorizado),
      precio_minimo: esAdmin ? numeroONull(f.precio_minimo) : null,
    }).select('id').single()

    if (errVeh || !veh) {
      if (subastaCreada) await supabase.from('subasta').delete().eq('id', subastaCreada)
      setGuardando(false)
      setError(errVeh?.message.includes('duplicate') ? `Ya existe una unidad con el folio ${f.id_interno}.` : `No se pudo guardar la unidad: ${errVeh?.message}`)
      set('paso', 0)
      return
    }

    const pasosGuardado: { nombre: string; correr: () => PromiseLike<{ error: { message: string } | null }> }[] = []
    if (esAdmin) {
      pasosGuardado.push({ nombre: 'la compra', correr: () => supabase!.from('compra').insert({
        vehiculo_id: veh.id, precio: Number(f.precio_martillo), comision: Number(f.comision) || 0, impuestos: 0, iva: 0,
      }) })
      if (f.gastos.length) pasosGuardado.push({ nombre: 'los gastos', correr: () => supabase!.from('gasto').insert(f.gastos.map((g) => ({
        vehiculo_id: veh.id, descripcion: g.descripcion.trim(), categoria_id: Number(g.categoriaId), importe: Number(g.importe), fecha: g.fecha, pagador_tipo: 'empresa',
      }))) })
      if (f.socios.length) pasosGuardado.push({ nombre: 'los socios', correr: () => supabase!.from('aportacion').insert(f.socios.map((s) => ({
        vehiculo_id: veh.id, socio_id: Number(s.socioId), monto: Number(s.monto), fecha: f.fecha_compra || hoyISO(),
      }))) })
    }
    if (tipos.length) pasosGuardado.push({ nombre: 'los documentos', correr: () => supabase!.from('documento').insert(tipos.map((t) => {
      const e = estadoDoc(t)
      return {
        vehiculo_id: veh.id, tipo_documento_id: t.id, activo: e !== 'no_aplica',
        estado: e === 'no_aplica' ? 'faltante' : e, fecha_obtencion: e === 'completo' ? hoyISO() : null,
      }
    })) })

    for (const p of pasosGuardado) {
      const { error } = await p.correr()
      if (error) {
        // Deshacer: la cascada de vehiculo se lleva lo que ya se haya guardado.
        await supabase.from('vehiculo').delete().eq('id', veh.id)
        if (subastaCreada) await supabase.from('subasta').delete().eq('id', subastaCreada)
        setGuardando(false)
        setError(`No se pudo guardar ${p.nombre}, así que no se guardó nada: ${error.message}`)
        return
      }
    }

    setGuardando(false)
    limpiarBorrador()
    navigate(`/vehiculo/${veh.id}`)
  }

  return (
    <div style={{ maxWidth: 940 }}>
      <PageHeader
        titulo="Alta de unidad"
        descripcion="Captura todo lo de la unidad en orden. Lo que llevas se guarda en este navegador aunque cierres la pestaña; en la base se guarda al final."
        volver={{ to: '/inventario', label: 'Inventario' }}
      />

      <div className="pasos">
        {pasos.map((p, k) => (
          <button key={p.i} type="button" className={`paso${k === posicion ? ' activo' : k < posicion ? ' hecho' : ''}`} onClick={() => ir(k)}>
            <span>{k < posicion ? '✓' : k + 1}</span>{p.titulo}
          </button>
        ))}
      </div>

      {error && <div style={{ marginBottom: 16 }}><Alerta>{error}</Alerta></div>}

      <div className="card">
        {pasoActual === 0 && (
          <div className="form">
            <div className="card-titulo">Datos de la unidad</div>
            <div className="form-grid">
              <Campo label="Folio interno" ayuda="Ej. V-1020"><input className="input" value={f.id_interno} onChange={(e) => set('id_interno', e.target.value)} autoFocus /></Campo>
              <Campo label="VIN / número de serie"><input className="input" value={f.vin} onChange={(e) => set('vin', e.target.value)} /></Campo>
            </div>
            <div className="form-grid">
              <Campo label="Marca"><input className="input" value={f.marca} onChange={(e) => set('marca', e.target.value)} /></Campo>
              <Campo label="Modelo"><input className="input" value={f.modelo} onChange={(e) => set('modelo', e.target.value)} /></Campo>
              <Campo label="Versión"><input className="input" value={f.version} onChange={(e) => set('version', e.target.value)} /></Campo>
              <Campo label="Año"><input className="input" type="number" min={1980} max={2100} value={f.anio} onChange={(e) => set('anio', e.target.value)} /></Campo>
            </div>
            <div className="form-grid">
              <Campo label="Kilometraje de llegada"><input className="input" type="number" min={0} value={f.kilometraje} onChange={(e) => set('kilometraje', e.target.value)} /></Campo>
              <Campo label="Color"><input className="input" value={f.color} onChange={(e) => set('color', e.target.value)} /></Campo>
              <Campo label="Transmisión">
                <select className="select" value={f.transmision} onChange={(e) => set('transmision', e.target.value)}>
                  <option value="automatica">Automática</option>
                  <option value="manual">Manual</option>
                  <option value="otra">Otra</option>
                </select>
              </Campo>
            </div>
          </div>
        )}

        {pasoActual === 1 && (
          <div className="form">
            <div className="card-titulo">Subasta y compra</div>
            <Campo label="Subasta donde se compró">
              <select className="select" value={f.subastaId} onChange={(e) => {
                const id = e.target.value
                const s = subastas.find((x) => String(x.id) === id)
                setF((x) => ({ ...x, subastaId: id, fecha_compra: s ? s.fecha : x.fecha_compra }))
              }}>
                <option value="">Sin subasta registrada</option>
                {subastas.map((s) => <option key={s.id} value={s.id}>{s.plataforma} · {fecha(s.fecha)}{s.lote ? ` · lote ${s.lote}` : ''}</option>)}
                <option value={NUEVA}>+ Registrar una subasta nueva</option>
              </select>
            </Campo>
            {f.subastaId === NUEVA && (
              <div className="form-grid">
                <Campo label="Plataforma"><input className="input" value={f.nuevaPlataforma} onChange={(e) => set('nuevaPlataforma', e.target.value)} /></Campo>
                <Campo label="Fecha de la subasta"><input className="input" type="date" value={f.nuevaFecha} onChange={(e) => { set('nuevaFecha', e.target.value); set('fecha_compra', e.target.value) }} /></Campo>
                <Campo label="Lote (opcional)"><input className="input" value={f.nuevoLote} onChange={(e) => set('nuevoLote', e.target.value)} /></Campo>
                <Campo label="Patio de origen (opcional)"><input className="input" value={f.nuevoPatio} onChange={(e) => set('nuevoPatio', e.target.value)} /></Campo>
              </div>
            )}
            {subastaElegida?.patio_origen && <p className="texto-muted" style={{ margin: 0 }}>Patio de origen: {subastaElegida.patio_origen}</p>}
            <div className="form-grid">
              <Campo label="Torre"><input className="input" value={f.torre} onChange={(e) => set('torre', e.target.value)} /></Campo>
              <Campo label="Fecha de compra" ayuda="Desde aquí se cuentan los días en inventario"><input className="input" type="date" value={f.fecha_compra} onChange={(e) => set('fecha_compra', e.target.value)} /></Campo>
            </div>
            <div className="form-grid">
              <Campo label="Precio de martillo"><input className="input" type="number" step="0.01" min={0} value={f.precio_martillo} onChange={(e) => set('precio_martillo', e.target.value)} /></Campo>
              <Campo label="Comisión de subasta"><input className="input" type="number" step="0.01" min={0} value={f.comision} onChange={(e) => set('comision', e.target.value)} /></Campo>
            </div>
            <div className="totales">
              <Dato label="Costo de compra" valor={mxn(costoCompra)} />
            </div>
          </div>
        )}

        {pasoActual === 2 && (
          <GastosPaso filas={f.gastos} categorias={categorias} fechaBase={f.fecha_compra}
            onCambiar={(g) => set('gastos', g)} costoCompra={costoCompra} totalGastos={totalGastos} />
        )}

        {pasoActual === 3 && (
          <SociosPaso filas={f.socios} socios={socios} costoTotal={costoTotal} totalAportado={totalAportado}
            onCambiar={(s) => set('socios', s)} />
        )}

        {pasoActual === 4 && (
          <div className="form">
            <div className="card-titulo">Documentos</div>
            <p className="card-sub" style={{ margin: 0 }}>Marca cómo están los papeles. Los archivos se suben después desde el expediente.</p>
            <div className="tabla-wrap">
              <table className="tabla">
                <thead><tr><th>Documento</th><th>Estado</th></tr></thead>
                <tbody>
                  {tipos.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 500 }}>{t.nombre}</td>
                      <td>
                        <select className="select select-chico" value={estadoDoc(t)}
                          onChange={(e) => set('documentos', { ...f.documentos, [t.id]: e.target.value as EstadoDoc })}>
                          <option value="faltante">{ESTADO_DOCUMENTO.faltante.label}</option>
                          <option value="en_tramite">{ESTADO_DOCUMENTO.en_tramite.label}</option>
                          <option value="completo">{ESTADO_DOCUMENTO.completo.label}</option>
                          <option value="no_aplica">No aplica a esta unidad</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {tipos.length === 0 && <tr><td colSpan={2} className="vacio">No hay documentos en el catálogo (Configuración → Catálogos).</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="card-titulo" style={{ marginTop: 8 }}>Precio de venta</div>
            <div className="form-grid">
              <Campo label="Precio autorizado (esperado)" ayuda="Se puede ajustar después en En venta">
                <input className="input" type="number" min={0} value={f.precio_autorizado} onChange={(e) => set('precio_autorizado', e.target.value)} />
              </Campo>
              {esAdmin && (
                <Campo label="Precio mínimo" ayuda="Solo lo ve el administrador">
                  <input className="input" type="number" min={0} value={f.precio_minimo} onChange={(e) => set('precio_minimo', e.target.value)} />
                </Campo>
              )}
            </div>
          </div>
        )}

        {pasoActual === 5 && (
          <div className="form">
            <div className="card-titulo">Revisa antes de guardar</div>
            <div className="datos">
              <Dato label="Unidad" valor={`${f.marca} ${f.modelo} ${f.anio}`} />
              <Dato label="Folio" valor={f.id_interno || '—'} />
              {esAdmin && <Dato label="Subasta" valor={f.subastaId === NUEVA ? `${f.nuevaPlataforma} · ${fecha(f.nuevaFecha)} (nueva)` : subastaElegida ? `${subastaElegida.plataforma} · ${fecha(subastaElegida.fecha)}` : 'Sin subasta'} />}
              <Dato label="Fecha de compra" valor={fecha(f.fecha_compra)} />
            </div>
            {esAdmin && (
              <div className="totales">
                <Dato label="Compra" valor={mxn(costoCompra)} />
                <Dato label={`Gastos (${f.gastos.length})`} valor={mxn(totalGastos)} />
                <Dato label="Costo total" valor={mxn(costoTotal)} />
                <Dato label="Precio autorizado" valor={precioVenta ? mxn(precioVenta) : '—'} />
                <Dato label="Utilidad proyectada" valor={<span style={{ color: utilidad !== null && utilidad < 0 ? 'var(--danger)' : undefined }}>{utilidad !== null ? mxn(utilidad) : '—'}</span>} />
                <Dato label="Margen" valor={margen !== null ? porcentaje(margen) : '—'} />
              </div>
            )}
            {esAdmin && (
              <div>
                <div className="dato-label" style={{ marginBottom: 4 }}>Socios</div>
                {f.socios.length === 0 ? <span className="texto-muted">Sin socios asignados (se pueden agregar después).</span> : (
                  <div>{f.socios.map((s) => {
                    const nombre = socios.find((x) => String(x.id) === s.socioId)?.nombre ?? '—'
                    const pct = totalAportado > 0 ? (Number(s.monto) || 0) / totalAportado : 0
                    return <div key={s.socioId}>{nombre}: <strong>{mxn(Number(s.monto))}</strong> · {porcentaje(pct)}</div>
                  })}</div>
                )}
              </div>
            )}
            <div>
              <div className="dato-label" style={{ marginBottom: 4 }}>Documentos</div>
              {tipos.filter((t) => estadoDoc(t) !== 'no_aplica').map((t) => (
                <span key={t.id} style={{ display: 'inline-block', marginRight: 12 }}>{t.nombre}: <strong>{ESTADO_DOCUMENTO[estadoDoc(t)]?.label}</strong></span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="form-acciones" style={{ marginTop: 16, justifyContent: 'space-between' }}>
        <button type="button" className="btn btn-secundario" disabled={posicion === 0} onClick={() => ir(posicion - 1)}>← Anterior</button>
        {posicion < pasos.length - 1
          ? <button type="button" className="btn btn-primario" onClick={() => ir(posicion + 1)}>Siguiente →</button>
          : <button type="button" className="btn btn-primario" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar unidad'}</button>}
      </div>
    </div>
  )
}

function GastosPaso({ filas, categorias, fechaBase, onCambiar, costoCompra, totalGastos }: {
  filas: FilaGasto[]
  categorias: CategoriaGasto[]
  fechaBase: string
  onCambiar: (f: FilaGasto[]) => void
  costoCompra: number
  totalGastos: number
}) {
  const cambiar = (i: number, k: keyof FilaGasto, v: string) => onCambiar(filas.map((g, j) => (j === i ? { ...g, [k]: v } : g)))
  const activas = categorias.filter((c) => c.activo)

  return (
    <div className="form">
      <div>
        <div className="card-titulo">Gastos de la unidad</div>
        <p className="card-sub" style={{ margin: 0 }}>Lo que se ha gastado en arreglarla. El total se va sumando solo; después puedes seguir agregando desde el expediente.</p>
      </div>
      {filas.map((g, i) => (
        <div key={i} className="fila-captura">
          <Campo label={i === 0 ? 'Descripción' : ''}><input className="input" value={g.descripcion} onChange={(e) => cambiar(i, 'descripcion', e.target.value)} placeholder="Ej. Pintura de puerta" /></Campo>
          <Campo label={i === 0 ? 'Categoría' : ''}>
            <select className="select" value={g.categoriaId} onChange={(e) => cambiar(i, 'categoriaId', e.target.value)}>
              <option value="">Elige…</option>
              {activas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
          <Campo label={i === 0 ? 'Importe' : ''}><input className="input input-num" type="number" step="0.01" min={0} value={g.importe} onChange={(e) => cambiar(i, 'importe', e.target.value)} /></Campo>
          <Campo label={i === 0 ? 'Fecha' : ''}><input className="input" type="date" value={g.fecha} onChange={(e) => cambiar(i, 'fecha', e.target.value)} /></Campo>
          <button type="button" className="btn-link peligro" style={{ marginBottom: 8 }} onClick={() => onCambiar(filas.filter((_, j) => j !== i))}>Quitar</button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-secundario"
          onClick={() => onCambiar([...filas, { descripcion: '', categoriaId: '', importe: '', fecha: filas.at(-1)?.fecha ?? fechaBase ?? hoyISO() }])}>
          + Agregar gasto
        </button>
      </div>
      <div className="totales">
        <Dato label="Compra" valor={mxn(costoCompra)} />
        <Dato label={`Gastos (${filas.length})`} valor={mxn(totalGastos)} />
        <Dato label="Costo total hasta ahora" valor={mxn(costoCompra + totalGastos)} />
      </div>
    </div>
  )
}

/** El % de cada socio sale de su monto entre el total aportado (igual que v_participacion_socio). */
function SociosPaso({ filas, socios, costoTotal, totalAportado, onCambiar }: {
  filas: FilaSocio[]
  socios: Socio[]
  costoTotal: number
  totalAportado: number
  onCambiar: (f: FilaSocio[]) => void
}) {
  const cambiar = (i: number, k: keyof FilaSocio, v: string) => onCambiar(filas.map((s, j) => (j === i ? { ...s, [k]: v } : s)))
  const porCubrir = costoTotal - totalAportado

  return (
    <div className="form">
      <div>
        <div className="card-titulo">Dueños / socios aportadores</div>
        <p className="card-sub" style={{ margin: 0 }}>
          Elige al socio y pon cuánto aportó, o escribe el porcentaje y se calcula el monto sobre el costo total ({mxn(costoTotal)}).
          El porcentaje final de cada quien sale de lo que aportó.
        </p>
      </div>
      {socios.length === 0 && <Alerta tipo="aviso">No hay socios activos. Dalos de alta en Socios y vuelve a este paso.</Alerta>}
      {filas.map((s, i) => {
        const monto = Number(s.monto) || 0
        const pct = totalAportado > 0 ? monto / totalAportado : 0
        return (
          <div key={i} className="fila-captura" style={{ gridTemplateColumns: '2fr 1.2fr 1fr 1fr auto' }}>
            <Campo label={i === 0 ? 'Socio' : ''}>
              <select className="select" value={s.socioId} onChange={(e) => cambiar(i, 'socioId', e.target.value)}>
                <option value="">Elige…</option>
                {socios.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select>
            </Campo>
            <Campo label={i === 0 ? 'Capital aportado' : ''}>
              <input className="input input-num" type="number" step="0.01" min={0} value={s.monto} onChange={(e) => cambiar(i, 'monto', e.target.value)} />
            </Campo>
            <Campo label={i === 0 ? '% del costo' : ''}>
              <input key={`${i}-${s.monto}-${costoTotal}`} className="input input-num" type="number" step="0.1" min={0} max={100} placeholder="%"
                defaultValue={costoTotal > 0 && monto > 0 ? String(Math.round((monto / costoTotal) * 1000) / 10) : ''}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                onBlur={(e) => {
                  if (e.target.value === '') return
                  cambiar(i, 'monto', String(Math.round(costoTotal * Number(e.target.value)) / 100))
                }} />
            </Campo>
            <Campo label={i === 0 ? 'Participación' : ''}>
              <div className="input" style={{ background: 'var(--surface-alt)', fontWeight: 600 }}>{porcentaje(pct)}</div>
            </Campo>
            <button type="button" className="btn-link peligro" style={{ marginBottom: 8 }} onClick={() => onCambiar(filas.filter((_, j) => j !== i))}>Quitar</button>
          </div>
        )
      })}
      <div>
        <button type="button" className="btn btn-secundario" disabled={socios.length === 0}
          onClick={() => onCambiar([...filas, { socioId: '', monto: '' }])}>
          + Agregar socio
        </button>
      </div>
      <div className="totales">
        <Dato label="Costo total" valor={mxn(costoTotal)} />
        <Dato label="Capital aportado" valor={mxn(totalAportado)} />
        <Dato label={porCubrir >= 0 ? 'Falta por cubrir' : 'Aportado de más'} valor={<span style={{ color: porCubrir > 0 ? 'var(--warning)' : undefined }}>{mxn(Math.abs(porCubrir))}</span>} />
      </div>
    </div>
  )
}
