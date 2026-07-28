import { useEffect, useState, type FormEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCatalogos } from '../lib/catalogos'
import { mxn, porcentaje } from '../lib/helpers'
import type { VehiculoFicha, Gasto, TipoDocumento, Documento } from '../types'

export default function Expediente() {
  const { id } = useParams()
  const { perfil } = useAuth()
  const { categorias } = useCatalogos()
  const [veh, setVeh] = useState<VehiculoFicha | null>(null)
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [cargando, setCargando] = useState(true)
  const [abrirForm, setAbrirForm] = useState(false)

  const puedeCapturarGasto = perfil?.rol === 'admin'
  const puedeEditarEstado = perfil?.rol === 'admin' || perfil?.rol === 'gerencia'
  const puedeEditarDocumentos = perfil?.rol === 'admin' || perfil?.rol === 'gerencia'

  async function recargar() {
    if (!supabase || !id) return
    const [vehRes, gastosRes, tiposRes, docsRes] = await Promise.all([
      supabase.from('v_vehiculo_ficha').select('*').eq('id', id).maybeSingle(),
      supabase.from('gasto').select('*').eq('vehiculo_id', id).order('fecha', { ascending: false }),
      supabase.from('tipo_documento').select('*').eq('activo', true).order('orden'),
      supabase.from('documento').select('*').eq('vehiculo_id', id),
    ])
    setVeh(vehRes.data as VehiculoFicha | null)
    setGastos((gastosRes.data ?? []) as Gasto[])
    setTiposDocumento((tiposRes.data ?? []) as TipoDocumento[])
    setDocumentos((docsRes.data ?? []) as Documento[])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [id])

  if (cargando) return <p>Cargando…</p>
  if (!veh) return <p>No se encontró la unidad.</p>

  const nombreCategoria = (catId: number) => categorias.find((c) => c.id === catId)?.nombre ?? '—'
  const dias = veh.fecha_compra ? Math.floor((Date.now() - new Date(veh.fecha_compra).getTime()) / 86400000) : null

  return (
    <div style={{ maxWidth: 760 }}>
      <Link to="/inventario" style={{ fontSize: 12, color: '#8b8578' }}>← Inventario</Link>

      <h1 style={{ font: '400 26px Georgia, serif', margin: '10px 0 2px' }}>
        {veh.marca} {veh.modelo} {veh.anio} <span style={{ color: '#8b8578', fontSize: 16 }}>· {veh.id_interno}</span>
      </h1>
      <p style={{ color: '#8b8578', fontSize: 12.5, marginTop: 0 }}>
        {veh.estado_comercial} · {dias !== null ? `${dias} días en inventario` : 'sin fecha de compra'} · papeles: {veh.estado_documental}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, margin: '18px 0' }}>
        <Dato label="Kilometraje" value={veh.kilometraje ? `${veh.kilometraje.toLocaleString('es-MX')} km` : '—'} />
        <Dato label="Color / transmisión" value={`${veh.color ?? '—'} · ${veh.transmision ?? '—'}`} />
        <Dato label="Precio autorizado" value={mxn(veh.precio_autorizado)} />
        {perfil?.rol === 'admin' && <Dato label="Precio mínimo" value={mxn(veh.precio_minimo)} />}
      </div>

      {(perfil?.rol === 'admin') && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24, background: '#fff', border: '1px solid #e4e0d8', padding: 14 }}>
          <Dato label="Costo total" value={mxn(veh.costo_total)} />
          <Dato label="Utilidad proyectada" value={mxn(veh.utilidad)} />
          <Dato label="Margen" value={porcentaje(veh.margen)} />
        </div>
      )}

      {puedeEditarEstado && (
        <EstadoEditor veh={veh} onGuardado={recargar} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #26302f', paddingBottom: 8, marginBottom: 4 }}>
        <h2 style={{ font: '500 15px "IBM Plex Sans"', margin: 0 }}>Gastos</h2>
        {puedeCapturarGasto && (
          <button onClick={() => setAbrirForm(true)} style={{ background: '#26302f', color: '#f3f1ec', border: 'none', padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
            + Registrar gasto
          </button>
        )}
      </div>

      {!puedeCapturarGasto && (
        <p style={{ fontSize: 12, color: '#8b8578', padding: '10px 0' }}>Tu rol no tiene acceso a los gastos de esta unidad.</p>
      )}

      {puedeCapturarGasto && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff' }}>
          <tbody>
            {gastos.map((g) => (
              <tr key={g.id} style={{ borderTop: '1px solid #f0ede6' }}>
                <td style={{ padding: '9px 10px' }}>{g.descripcion}</td>
                <td style={{ padding: '9px 10px', color: '#8b8578' }}>{nombreCategoria(g.categoria_id)} · {g.fecha}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{mxn(g.importe)}</td>
              </tr>
            ))}
            {gastos.length === 0 && (
              <tr><td style={{ padding: 16, textAlign: 'center', color: '#8b8578' }}>Sin gastos capturados todavía.</td></tr>
            )}
          </tbody>
        </table>
      )}

      {abrirForm && (
        <GastoModal
          vehiculoId={veh.id}
          categorias={categorias}
          onClose={() => setAbrirForm(false)}
          onGuardado={() => { setAbrirForm(false); recargar() }}
        />
      )}

      <h2 style={{ font: '500 15px "IBM Plex Sans"', borderBottom: '1.5px solid #26302f', paddingBottom: 8, marginBottom: 4, marginTop: 28 }}>
        Documentación
      </h2>
      <DocumentoChecklist
        vehiculoId={veh.id}
        tiposDocumento={tiposDocumento}
        documentos={documentos}
        puedeEditar={puedeEditarDocumentos}
        onCambio={recargar}
      />
    </div>
  )
}

/**
 * Checklist de documentos (RN-11): cada tipo_documento obligatorio debe
 * llegar a 'completo' antes de vender. Un tipo sin fila de documento
 * todavía cuenta como faltante.
 */
function DocumentoChecklist({ vehiculoId, tiposDocumento, documentos, puedeEditar, onCambio }: {
  vehiculoId: number
  tiposDocumento: TipoDocumento[]
  documentos: Documento[]
  puedeEditar: boolean
  onCambio: () => void
}) {
  const [guardandoId, setGuardandoId] = useState<number | null>(null)

  async function cambiarEstado(tipo: TipoDocumento, estado: Documento['estado']) {
    if (!supabase) return
    setGuardandoId(tipo.id)
    const existente = documentos.find((d) => d.tipo_documento_id === tipo.id)
    if (existente) {
      await supabase.from('documento').update({
        estado, fecha_obtencion: estado === 'completo' ? new Date().toISOString().slice(0, 10) : null,
      }).eq('id', existente.id)
    } else {
      await supabase.from('documento').insert({
        vehiculo_id: vehiculoId, tipo_documento_id: tipo.id, estado,
        fecha_obtencion: estado === 'completo' ? new Date().toISOString().slice(0, 10) : null,
      })
    }
    setGuardandoId(null)
    onCambio()
  }

  if (tiposDocumento.length === 0) {
    return <p style={{ fontSize: 12, color: '#8b8578', padding: '10px 0' }}>Sin catálogo de documentos disponible.</p>
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff' }}>
      <tbody>
        {tiposDocumento.map((tipo) => {
          const doc = documentos.find((d) => d.tipo_documento_id === tipo.id)
          const estado = doc?.estado ?? 'faltante'
          return (
            <tr key={tipo.id} style={{ borderTop: '1px solid #f0ede6', opacity: guardandoId === tipo.id ? 0.5 : 1 }}>
              <td style={{ padding: '9px 10px' }}>
                {tipo.nombre} {tipo.obligatorio && <span style={{ color: '#8b8578', fontSize: 10.5 }}>· obligatorio</span>}
              </td>
              <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                {puedeEditar ? (
                  <select
                    value={estado}
                    onChange={(e) => cambiarEstado(tipo, e.target.value as Documento['estado'])}
                    style={{ padding: '5px 7px', border: '1px solid #ddd8d0', fontSize: 12, fontFamily: 'inherit' }}
                  >
                    <option value="faltante">Faltante</option>
                    <option value="en_tramite">En trámite</option>
                    <option value="completo">Completo</option>
                  </select>
                ) : (
                  <EstadoBadge estado={estado} />
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function EstadoBadge({ estado }: { estado: Documento['estado'] }) {
  const color = estado === 'completo' ? 'oklch(0.45 0.09 150)' : estado === 'en_tramite' ? 'oklch(0.55 0.13 85)' : 'oklch(0.48 0.13 32)'
  const label = estado === 'completo' ? 'Completo' : estado === 'en_tramite' ? 'En trámite' : 'Faltante'
  return <span style={{ fontSize: 11.5, color }}>{label}</span>
}

const COMERCIAL_OPCIONES = ['no_publicado', 'publicado', 'en_consignacion', 'con_referidos', 'apartado', 'vendido']
const DOCUMENTAL_OPCIONES = ['incompleto', 'en_tramite', 'completo']

/**
 * Cambiar estado comercial y documental de esta unidad. estado_proceso y
 * ubicación NO se editan aquí — se administran para todas las unidades a
 * la vez desde "En proceso" / "En venta", donde tiene más sentido verlas
 * en conjunto que unidad por unidad.
 */
function EstadoEditor({ veh, onGuardado }: {
  veh: VehiculoFicha
  onGuardado: () => void
}) {
  const [estadoComercial, setEstadoComercial] = useState(veh.estado_comercial)
  const [estadoDocumental, setEstadoDocumental] = useState(veh.estado_documental)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const huboCambios = veh.estado_comercial !== estadoComercial || veh.estado_documental !== estadoDocumental

  async function guardar() {
    if (!supabase) return
    setGuardando(true)
    setError(null)
    setOk(false)

    const { error } = await supabase.from('vehiculo').update({
      estado_comercial: estadoComercial,
      estado_documental: estadoDocumental,
    }).eq('id', veh.id)

    setGuardando(false)
    if (error) { setError(error.message); return }
    setOk(true)
    onGuardado()
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e4e0d8', padding: 14, marginBottom: 24 }}>
      <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8b8578', marginBottom: 10 }}>
        Estado comercial y documental
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 10 }}>
        <select value={estadoComercial} onChange={(e) => setEstadoComercial(e.target.value)} style={selectStyle}>
          {COMERCIAL_OPCIONES.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={estadoDocumental} onChange={(e) => setEstadoDocumental(e.target.value)} style={selectStyle}>
          {DOCUMENTAL_OPCIONES.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={guardar}
          disabled={!huboCambios || guardando}
          style={{
            padding: '7px 14px', fontSize: 12, border: 'none', cursor: huboCambios ? 'pointer' : 'default',
            background: huboCambios ? '#26302f' : '#e8e4dc', color: huboCambios ? '#f3f1ec' : '#a09889',
          }}
        >
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
        {ok && !huboCambios && <span style={{ fontSize: 11.5, color: 'oklch(0.45 0.09 150)' }}>Guardado ✓</span>}
        {error && <span style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)' }}>{error}</span>}
      </div>
    </div>
  )
}

const selectStyle: React.CSSProperties = { padding: '7px 8px', border: '1px solid #ddd8d0', fontSize: 12.5, fontFamily: 'inherit' }

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8b8578', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  )
}

/**
 * Captura de gasto (RN-01, la pantalla que el análisis marca como la más
 * critica: "cada gasto perdido es utilidad mal repartida"). Campos
 * mínimos a propósito: descripción, categoría, importe, fecha, pagador.
 */
function GastoModal({ vehiculoId, categorias, onClose, onGuardado }: {
  vehiculoId: number
  categorias: { id: number; nombre: string }[]
  onClose: () => void
  onGuardado: () => void
}) {
  const [descripcion, setDescripcion] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [importe, setImporte] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)

    const { error } = await supabase.from('gasto').insert({
      vehiculo_id: vehiculoId,
      categoria_id: Number(categoriaId),
      descripcion,
      importe: Number(importe),
      fecha,
      pagador_tipo: 'empresa',
    })

    setGuardando(false)
    if (error) { setError(error.message); return }
    onGuardado()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()} style={{ background: '#fff', padding: 22, width: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0, font: '500 16px Georgia, serif' }}>Nuevo gasto</h3>

        <input required placeholder="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} style={inputStyle} />

        <select required value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} style={inputStyle}>
          <option value="">Categoría…</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>

        <input required type="number" step="0.01" placeholder="Importe" value={importe} onChange={(e) => setImporte(e.target.value)} style={inputStyle} />
        <input required type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputStyle} />

        {error && <div style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 10, background: '#f4f1ea', border: 'none', cursor: 'pointer' }}>Cancelar</button>
          <button type="submit" disabled={guardando} style={{ flex: 1, padding: 10, background: '#26302f', color: '#f3f1ec', border: 'none', cursor: 'pointer' }}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = { padding: '8px 10px', border: '1px solid #ddd8d0', fontSize: 13.5, fontFamily: 'inherit' }
