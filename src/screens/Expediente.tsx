import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCatalogos } from '../lib/catalogos'
import { mxn, porcentaje } from '../lib/helpers'
import { Modal } from '../components/Ui'
import type { VehiculoFicha, Gasto, TipoDocumento, Documento, Aportacion, Socio } from '../types'

export default function Expediente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const { categorias } = useCatalogos()
  const [veh, setVeh] = useState<VehiculoFicha | null>(null)
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [aportaciones, setAportaciones] = useState<Aportacion[]>([])
  const [socios, setSocios] = useState<Socio[]>([])
  const [cargando, setCargando] = useState(true)
  const [abrirForm, setAbrirForm] = useState(false)

  const puedeCapturarGasto = perfil?.rol === 'admin'
  const puedeEditarEstado = perfil?.rol === 'admin' || perfil?.rol === 'gerencia'
  const puedeEditarDocumentos = perfil?.rol === 'admin' || perfil?.rol === 'gerencia'
  const puedeVerCapital = perfil?.rol === 'admin'

  async function recargar() {
    if (!supabase || !id) return
    const [vehRes, gastosRes, tiposRes, docsRes, aportRes, sociosRes] = await Promise.all([
      supabase.from('v_vehiculo_ficha').select('*').eq('id', id).maybeSingle(),
      supabase.from('gasto').select('*').eq('vehiculo_id', id).order('fecha', { ascending: false }),
      supabase.from('tipo_documento').select('*').eq('activo', true).order('orden'),
      supabase.from('documento').select('*').eq('vehiculo_id', id),
      supabase.from('aportacion').select('*').eq('vehiculo_id', id).order('fecha'),
      supabase.from('socio').select('*').order('nombre'),
    ])
    setVeh(vehRes.data as VehiculoFicha | null)
    setGastos((gastosRes.data ?? []) as Gasto[])
    setTiposDocumento((tiposRes.data ?? []) as TipoDocumento[])
    setDocumentos((docsRes.data ?? []) as Documento[])
    setAportaciones((aportRes.data ?? []) as Aportacion[])
    setSocios((sociosRes.data ?? []) as Socio[])
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

      {puedeVerCapital && (
        <CapitalSocios
          vehiculoId={veh.id}
          aportaciones={aportaciones}
          socios={socios}
          onCambio={recargar}
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

      {perfil?.rol === 'admin' && (
        <MargenPublicacion costoTotal={veh.costo_total} />
      )}

      {puedeEditarDocumentos && (
        <PublicacionForm veh={veh} onGuardado={recargar} />
      )}

      {perfil?.rol === 'admin' && (
        <EliminarUnidad veh={veh} documentos={documentos} onEliminada={() => navigate('/inventario')} />
      )}
    </div>
  )
}

/**
 * Dar de baja una unidad completa (RN básica de cualquier ERP: si algo se
 * puede agregar, también se debe poder quitar). Cascada en la base ya
 * borra compra/gasto/documento/venta/etc — aquí solo hay que limpiar los
 * archivos de Storage primero (Postgres no sabe de su existencia) y pedir
 * que se escriba el folio para confirmar, porque es irreversible.
 */
function EliminarUnidad({ veh, documentos, onEliminada }: {
  veh: VehiculoFicha
  documentos: Documento[]
  onEliminada: () => void
}) {
  const [abrir, setAbrir] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function eliminar() {
    if (!supabase) return
    setEliminando(true)
    setError(null)

    const rutas = documentos.map((d) => d.archivo_path).filter((p): p is string => Boolean(p))
    if (rutas.length > 0) {
      await supabase.storage.from(BUCKET_DOCUMENTOS).remove(rutas)
    }

    const { error: errBorrar } = await supabase.from('vehiculo').delete().eq('id', veh.id)
    setEliminando(false)
    if (errBorrar) { setError(errBorrar.message); return }
    onEliminada()
  }

  return (
    <div style={{ marginTop: 36, paddingTop: 16, borderTop: '1px solid #e4e0d8' }}>
      <button
        onClick={() => setAbrir(true)}
        style={{ background: 'none', border: '1px solid oklch(0.48 0.13 32)', color: 'oklch(0.48 0.13 32)', padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}
      >
        Eliminar unidad
      </button>

      {abrir && (
        <Modal onClose={() => setAbrir(false)}>
          <h3 style={{ margin: '0 0 8px', font: '500 16px Georgia, serif' }}>Eliminar {veh.id_interno}</h3>
          <p style={{ fontSize: 12.5, color: '#55524b', lineHeight: 1.5 }}>
            Esto borra la unidad y todo lo que depende de ella: compra, gastos, documentos y archivos,
            aportaciones, y si ya se vendió, la venta y el cierre financiero. No se puede deshacer.
          </p>
          <p style={{ fontSize: 12.5, color: '#55524b' }}>
            Escribe <strong>{veh.id_interno}</strong> para confirmar:
          </p>
          <input
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid #ddd8d0', fontSize: 13.5, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
          />
          {error && <p style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)', marginTop: 8 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setAbrir(false)}
              style={{ flex: 1, padding: 10, background: '#f4f1ea', border: 'none', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={eliminar}
              disabled={confirmacion !== veh.id_interno || eliminando}
              style={{
                flex: 1, padding: 10, border: 'none',
                cursor: confirmacion === veh.id_interno && !eliminando ? 'pointer' : 'default',
                background: confirmacion === veh.id_interno ? 'oklch(0.48 0.13 32)' : '#e8e4dc',
                color: confirmacion === veh.id_interno ? '#fff' : '#a09889',
              }}
            >
              {eliminando ? 'Eliminando…' : 'Eliminar definitivamente'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

const BUCKET_DOCUMENTOS = 'documentos-vehiculo'

/**
 * Checklist de documentos: cada categoría (tipo_documento) se puede
 * activar o desactivar POR VEHÍCULO (documento.activo) porque el tipo de
 * papeles que trae cada carro varía mucho — una categoría desactivada no
 * cuenta como faltante, solo no aplica a esta unidad. El catálogo mismo
 * (nombre de la categoría) también es editable y borrable aquí, no solo
 * las que uno agrega — el FK de documento protege el borrado si ya tiene
 * un archivo cargado.
 */
function DocumentoChecklist({ vehiculoId, tiposDocumento, documentos, puedeEditar, onCambio }: {
  vehiculoId: number
  tiposDocumento: TipoDocumento[]
  documentos: Documento[]
  puedeEditar: boolean
  onCambio: () => void
}) {
  const [ocupadoId, setOcupadoId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [creandoCategoria, setCreandoCategoria] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [nombreEditado, setNombreEditado] = useState('')

  function documentoDe(tipoId: number): Documento | { activo: true; estado: 'faltante'; archivo_path: null } {
    return documentos.find((d) => d.tipo_documento_id === tipoId) ?? { activo: true, estado: 'faltante', archivo_path: null }
  }

  async function actualizarDocumento(tipo: TipoDocumento, cambios: Partial<Documento>) {
    if (!supabase) return
    setOcupadoId(tipo.id)
    const existente = documentos.find((d) => d.tipo_documento_id === tipo.id)
    if (existente) {
      await supabase.from('documento').update(cambios).eq('id', existente.id)
    } else {
      await supabase.from('documento').insert({ vehiculo_id: vehiculoId, tipo_documento_id: tipo.id, estado: 'faltante', ...cambios })
    }
    setOcupadoId(null)
    onCambio()
  }

  async function cambiarActivo(tipo: TipoDocumento, activo: boolean) {
    await actualizarDocumento(tipo, { activo })
  }

  async function cambiarEstado(tipo: TipoDocumento, estado: Documento['estado']) {
    await actualizarDocumento(tipo, { estado, fecha_obtencion: estado === 'completo' ? new Date().toISOString().slice(0, 10) : null })
  }

  async function subirArchivo(tipo: TipoDocumento, archivo: File) {
    if (!supabase) return
    setError(null)
    setOcupadoId(tipo.id)
    const ruta = `${vehiculoId}/${tipo.id}/${Date.now()}-${archivo.name}`
    const { error: errSubida } = await supabase.storage.from(BUCKET_DOCUMENTOS).upload(ruta, archivo)
    if (errSubida) {
      setOcupadoId(null)
      setError(`No se pudo subir el archivo: ${errSubida.message}`)
      return
    }
    const hoy = new Date().toISOString().slice(0, 10)
    setOcupadoId(null)
    await actualizarDocumento(tipo, { estado: 'completo', archivo_path: ruta, fecha_obtencion: hoy })
  }

  async function verArchivo(doc: Documento) {
    if (!supabase || !doc.archivo_path) return
    const { data, error: errUrl } = await supabase.storage.from(BUCKET_DOCUMENTOS).createSignedUrl(doc.archivo_path, 120)
    if (errUrl || !data) { setError('No se pudo abrir el archivo.'); return }
    window.open(data.signedUrl, '_blank')
  }

  async function quitarArchivo(doc: Documento) {
    if (!supabase || !doc.archivo_path) return
    setOcupadoId(doc.tipo_documento_id)
    await supabase.storage.from(BUCKET_DOCUMENTOS).remove([doc.archivo_path])
    await supabase.from('documento').update({ archivo_path: null, estado: 'faltante', fecha_obtencion: null }).eq('id', doc.id)
    setOcupadoId(null)
    onCambio()
  }

  async function crearCategoria(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !nuevaCategoria.trim()) return
    setCreandoCategoria(true)
    setError(null)
    // normalize('NFD') separa acentos de su letra base (a + acento) para
    // que el replace del bloque Unicode de marcas combinantes
    // (U+0300-U+036F) las quite sin perder la letra base.
    const clave = nuevaCategoria.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') + '_' + Date.now().toString().slice(-5)
    const { error: errCrear } = await supabase.from('tipo_documento').insert({
      clave, nombre: nuevaCategoria.trim(), obligatorio: false, confidencial: true, orden: 500, es_personalizado: true,
    })
    setCreandoCategoria(false)
    if (errCrear) { setError(errCrear.message); return }
    setNuevaCategoria('')
    onCambio()
  }

  async function guardarNombre(tipo: TipoDocumento) {
    if (!supabase || !nombreEditado.trim() || nombreEditado.trim() === tipo.nombre) { setEditandoId(null); return }
    setOcupadoId(tipo.id)
    setError(null)
    const { error: errRenombrar } = await supabase.from('tipo_documento').update({ nombre: nombreEditado.trim() }).eq('id', tipo.id)
    setOcupadoId(null)
    setEditandoId(null)
    if (errRenombrar) { setError(errRenombrar.message); return }
    onCambio()
  }

  async function eliminarCategoria(tipo: TipoDocumento) {
    if (!supabase) return
    setError(null)
    setOcupadoId(tipo.id)
    const { error: errBorrar } = await supabase.from('tipo_documento').delete().eq('id', tipo.id)
    setOcupadoId(null)
    if (errBorrar) { setError('No se puede eliminar: ya tiene un documento cargado en esta u otra unidad.'); return }
    onCambio()
  }

  return (
    <div>
      {tiposDocumento.length === 0 ? (
        <p style={{ fontSize: 12, color: '#8b8578', padding: '10px 0' }}>Sin catálogo de documentos disponible.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff' }}>
          <thead>
            <tr style={{ background: '#faf9f6', textAlign: 'left' }}>
              <th style={{ padding: '8px 10px', fontSize: 9.5, textTransform: 'uppercase', color: '#6b665c' }}>Aplica</th>
              <th style={{ padding: '8px 10px', fontSize: 9.5, textTransform: 'uppercase', color: '#6b665c' }}>Categoría</th>
              <th style={{ padding: '8px 10px', fontSize: 9.5, textTransform: 'uppercase', color: '#6b665c' }}>Estado</th>
              <th style={{ padding: '8px 10px', fontSize: 9.5, textTransform: 'uppercase', color: '#6b665c', textAlign: 'right' }}>Archivo</th>
            </tr>
          </thead>
          <tbody>
            {tiposDocumento.map((tipo) => {
              const doc = documentoDe(tipo.id)
              const ocupado = ocupadoId === tipo.id
              const activo = doc.activo
              return (
                <tr key={tipo.id} style={{ borderTop: '1px solid #f0ede6', opacity: ocupado ? 0.5 : activo ? 1 : 0.5 }}>
                  <td style={{ padding: '9px 10px' }}>
                    <input
                      type="checkbox"
                      checked={activo}
                      disabled={!puedeEditar || ocupado}
                      onChange={(e) => cambiarActivo(tipo, e.target.checked)}
                      title="¿Esta categoría aplica a esta unidad?"
                    />
                  </td>
                  <td style={{ padding: '9px 10px' }}>
                    {editandoId === tipo.id ? (
                      <span style={{ display: 'inline-flex', gap: 6 }}>
                        <input
                          autoFocus
                          value={nombreEditado}
                          onChange={(e) => setNombreEditado(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') guardarNombre(tipo); if (e.key === 'Escape') setEditandoId(null) }}
                          style={{ padding: '4px 6px', border: '1px solid #ddd8d0', fontSize: 12.5, fontFamily: 'inherit' }}
                        />
                        <button onClick={() => guardarNombre(tipo)} style={{ background: 'none', border: 'none', color: 'oklch(0.45 0.09 215)', fontSize: 11, cursor: 'pointer', padding: 0 }}>Guardar</button>
                        <button onClick={() => setEditandoId(null)} style={{ background: 'none', border: 'none', color: '#8b8578', fontSize: 11, cursor: 'pointer', padding: 0 }}>Cancelar</button>
                      </span>
                    ) : (
                      <>
                        {tipo.nombre}
                        {puedeEditar && (
                          <>
                            <button
                              onClick={() => { setEditandoId(tipo.id); setNombreEditado(tipo.nombre) }}
                              style={{ background: 'none', border: 'none', color: '#8b8578', fontSize: 11, cursor: 'pointer', marginLeft: 8, padding: 0 }}
                            >
                              editar
                            </button>
                            <button
                              onClick={() => eliminarCategoria(tipo)}
                              disabled={ocupado}
                              style={{ background: 'none', border: 'none', color: '#8b8578', fontSize: 11, cursor: 'pointer', marginLeft: 8, padding: 0 }}
                            >
                              eliminar
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </td>
                  <td style={{ padding: '9px 10px' }}>
                    {!activo ? (
                      <span style={{ fontSize: 11.5, color: '#8b8578' }}>No aplica</span>
                    ) : puedeEditar ? (
                      <select
                        value={doc.estado}
                        onChange={(e) => cambiarEstado(tipo, e.target.value as Documento['estado'])}
                        disabled={ocupado}
                        style={{ padding: '5px 7px', border: '1px solid #ddd8d0', fontSize: 12, fontFamily: 'inherit' }}
                      >
                        <option value="faltante">Faltante</option>
                        <option value="en_tramite">En trámite</option>
                        <option value="completo">Completo</option>
                      </select>
                    ) : (
                      <EstadoBadge estado={doc.estado} />
                    )}
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                    {!activo ? (
                      <span style={{ fontSize: 11.5, color: '#8b8578' }}>—</span>
                    ) : doc.archivo_path ? (
                      <span style={{ display: 'inline-flex', gap: 10 }}>
                        <button onClick={() => verArchivo(doc as Documento)} style={{ background: 'none', border: 'none', color: 'oklch(0.45 0.09 215)', fontSize: 11.5, cursor: 'pointer', padding: 0 }}>
                          Ver archivo
                        </button>
                        {puedeEditar && (
                          <button onClick={() => quitarArchivo(doc as Documento)} disabled={ocupado} style={{ background: 'none', border: 'none', color: 'oklch(0.48 0.13 32)', fontSize: 11.5, cursor: 'pointer', padding: 0 }}>
                            Quitar
                          </button>
                        )}
                      </span>
                    ) : puedeEditar ? (
                      <label style={{ fontSize: 11.5, color: 'oklch(0.45 0.09 215)', cursor: ocupado ? 'default' : 'pointer' }}>
                        {ocupado ? 'Subiendo…' : 'Subir archivo'}
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
                          disabled={ocupado}
                          style={{ display: 'none' }}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) subirArchivo(tipo, f); e.target.value = '' }}
                        />
                      </label>
                    ) : (
                      <span style={{ fontSize: 11.5, color: '#8b8578' }}>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {error && <p style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)', marginTop: 8 }}>{error}</p>}

      {puedeEditar && (
        <form onSubmit={crearCategoria} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            placeholder="Nombre de la nueva categoría…"
            value={nuevaCategoria}
            onChange={(e) => setNuevaCategoria(e.target.value)}
            style={{ padding: '7px 9px', border: '1px solid #ddd8d0', fontSize: 12.5, fontFamily: 'inherit', flex: 1, maxWidth: 260 }}
          />
          <button type="submit" disabled={creandoCategoria || !nuevaCategoria.trim()} style={{ background: '#fff', color: '#26302f', border: '1px solid #26302f', padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>
            + Nueva categoría
          </button>
        </form>
      )}
    </div>
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
 * Cambiar estado comercial y documental de esta unidad, y el kilometraje
 * final (etapa 2→3 del ciclo: se captura al terminar la reparación porque
 * el de llegada a veces viene alterado desde la subasta — kilometraje no
 * se sobreescribe, kilometraje_final es un campo aparte). estado_proceso y
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
  const [kilometrajeFinal, setKilometrajeFinal] = useState(veh.kilometraje_final !== null ? String(veh.kilometraje_final) : '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const kilometrajeFinalActual = veh.kilometraje_final !== null ? String(veh.kilometraje_final) : ''
  const huboCambios = veh.estado_comercial !== estadoComercial || veh.estado_documental !== estadoDocumental
    || kilometrajeFinal !== kilometrajeFinalActual

  async function guardar() {
    if (!supabase) return
    setGuardando(true)
    setError(null)
    setOk(false)

    const { error } = await supabase.from('vehiculo').update({
      estado_comercial: estadoComercial,
      estado_documental: estadoDocumental,
      kilometraje_final: kilometrajeFinal ? Number(kilometrajeFinal) : null,
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
        <select value={estadoComercial} onChange={(e) => setEstadoComercial(e.target.value)} style={selectStyle}>
          {COMERCIAL_OPCIONES.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={estadoDocumental} onChange={(e) => setEstadoDocumental(e.target.value)} style={selectStyle}>
          {DOCUMENTAL_OPCIONES.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <input
          type="number"
          placeholder="Kilometraje final (al terminar reparación)"
          value={kilometrajeFinal}
          onChange={(e) => setKilometrajeFinal(e.target.value)}
          style={selectStyle}
        />
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

/**
 * Margen para decidir el precio de venta (etapa 3): el precio de mercado
 * cambia después de la reparación, así que se captura aquí como valor
 * transitorio (no se guarda) contra el costo_total ya cerrado — el
 * administrador ve la utilidad/margen resultante antes de fijar
 * precio_autorizado (que se edita en "En venta").
 */
function MargenPublicacion({ costoTotal }: { costoTotal: number | null }) {
  const [precioMercado, setPrecioMercado] = useState('')
  const precio = Number(precioMercado) || 0
  const costo = costoTotal ?? 0
  const utilidad = precio > 0 ? precio - costo : null
  const margen = precio > 0 ? (precio - costo) / precio : null

  return (
    <div style={{ background: '#fff', border: '1px solid #e4e0d8', padding: 14, marginTop: 28 }}>
      <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8b8578', marginBottom: 10 }}>
        Margen para decidir precio de venta
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <label style={{ fontSize: 11, color: '#55524b' }}>
          Precio de mercado actual
          <input
            type="number" step="0.01" value={precioMercado}
            onChange={(e) => setPrecioMercado(e.target.value)}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginTop: 4, display: 'block' }}
          />
        </label>
        <Dato label="Costo total" value={mxn(costo)} />
        <Dato label="Utilidad estimada" value={utilidad !== null ? mxn(utilidad) : '—'} />
        <Dato label="Margen estimado" value={margen !== null ? porcentaje(margen) : '—'} />
      </div>
    </div>
  )
}

/**
 * Información de publicación para comisionistas (etapa 3): lo que el
 * portal de comisionista muestra en su catálogo. comision_ofrecida es
 * distinta de la comisión real que se liquida al cerrar una venta
 * específica (tabla comision) — esta es la que se ofrece de entrada.
 */
function PublicacionForm({ veh, onGuardado }: { veh: VehiculoFicha; onGuardado: () => void }) {
  const [descripcion, setDescripcion] = useState(veh.descripcion_breve ?? '')
  const [indicaciones, setIndicaciones] = useState(veh.indicaciones_comisionista ?? '')
  const [comision, setComision] = useState(veh.comision_ofrecida !== null ? String(veh.comision_ofrecida) : '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const comisionActual = veh.comision_ofrecida !== null ? String(veh.comision_ofrecida) : ''
  const huboCambios = descripcion !== (veh.descripcion_breve ?? '') || indicaciones !== (veh.indicaciones_comisionista ?? '')
    || comision !== comisionActual

  async function guardar() {
    if (!supabase) return
    setGuardando(true)
    setError(null)
    setOk(false)

    const { error } = await supabase.from('vehiculo').update({
      descripcion_breve: descripcion.trim() || null,
      indicaciones_comisionista: indicaciones.trim() || null,
      comision_ofrecida: comision ? Number(comision) : null,
    }).eq('id', veh.id)

    setGuardando(false)
    if (error) { setError(error.message); return }
    setOk(true)
    onGuardado()
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e4e0d8', padding: 14, marginTop: 16 }}>
      <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8b8578', marginBottom: 10 }}>
        Publicación para venta / información para comisionistas
      </div>
      <textarea
        placeholder="Descripción breve"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        rows={2}
        style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 8, resize: 'vertical', display: 'block' }}
      />
      <textarea
        placeholder="Indicaciones para comisionistas"
        value={indicaciones}
        onChange={(e) => setIndicaciones(e.target.value)}
        rows={2}
        style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 8, resize: 'vertical', display: 'block' }}
      />
      <input
        type="number" step="0.01" placeholder="Comisión ofrecida"
        value={comision} onChange={(e) => setComision(e.target.value)}
        style={{ ...inputStyle, width: 220 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
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

/**
 * Capital de socios asignado a ESTA unidad — se ve y se edita aquí mismo
 * (no solo desde la pantalla Socios) justamente para que quede claro, al
 * ver el inventario, de quién es el dinero metido en cada carro y no se
 * mezcle entre socios. Participación se calcula localmente sobre el total
 * de esta unidad (mismo criterio que v_participacion_socio).
 */
function CapitalSocios({ vehiculoId, aportaciones, socios, onCambio }: {
  vehiculoId: number
  aportaciones: Aportacion[]
  socios: Socio[]
  onCambio: () => void
}) {
  const [abrirForm, setAbrirForm] = useState(false)
  const [editando, setEditando] = useState<Aportacion | null>(null)
  const [error, setError] = useState<string | null>(null)

  const total = aportaciones.reduce((acc, a) => acc + a.monto, 0)

  function nombreSocio(id: number) {
    return socios.find((s) => s.id === id)?.nombre ?? '—'
  }

  async function eliminar(aportacion: Aportacion) {
    if (!supabase) return
    setError(null)
    const { error: errBorrar } = await supabase.from('aportacion').delete().eq('id', aportacion.id)
    if (errBorrar) { setError(errBorrar.message); return }
    onCambio()
  }

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #26302f', paddingBottom: 8, marginBottom: 4 }}>
        <h2 style={{ font: '500 15px "IBM Plex Sans"', margin: 0 }}>Capital / Socios</h2>
        <button onClick={() => setAbrirForm(true)} style={{ background: '#26302f', color: '#f3f1ec', border: 'none', padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
          + Asignar socio
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff' }}>
        <tbody>
          {aportaciones.map((a) => (
            <tr key={a.id} style={{ borderTop: '1px solid #f0ede6' }}>
              <td style={{ padding: '9px 10px' }}>{nombreSocio(a.socio_id)}</td>
              <td style={{ padding: '9px 10px', color: '#8b8578' }}>{a.fecha}</td>
              <td style={{ padding: '9px 10px', textAlign: 'right' }}>{total > 0 ? `${((a.monto / total) * 100).toFixed(1)}%` : '—'}</td>
              <td style={{ padding: '9px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{mxn(a.monto)}</td>
              <td style={{ padding: '9px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button onClick={() => setEditando(a)} style={{ background: 'none', border: 'none', color: '#8b8578', fontSize: 11, cursor: 'pointer', marginRight: 10, padding: 0 }}>editar</button>
                <button onClick={() => eliminar(a)} style={{ background: 'none', border: 'none', color: '#8b8578', fontSize: 11, cursor: 'pointer', padding: 0 }}>eliminar</button>
              </td>
            </tr>
          ))}
          {aportaciones.length === 0 && (
            <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#8b8578' }}>Sin capital de socios asignado a esta unidad.</td></tr>
          )}
        </tbody>
      </table>
      {error && <p style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)', marginTop: 8 }}>{error}</p>}

      {(abrirForm || editando) && (
        <AportacionVehiculoModal
          vehiculoId={vehiculoId}
          socios={socios}
          aportacion={editando}
          onClose={() => { setAbrirForm(false); setEditando(null) }}
          onGuardado={() => { setAbrirForm(false); setEditando(null); onCambio() }}
        />
      )}
    </div>
  )
}

function AportacionVehiculoModal({ vehiculoId, socios, aportacion, onClose, onGuardado }: {
  vehiculoId: number
  socios: Socio[]
  aportacion: Aportacion | null
  onClose: () => void
  onGuardado: () => void
}) {
  const [socioId, setSocioId] = useState(aportacion ? String(aportacion.socio_id) : '')
  const [monto, setMonto] = useState(aportacion ? String(aportacion.monto) : '')
  const [fecha, setFecha] = useState(aportacion?.fecha ?? new Date().toISOString().slice(0, 10))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    const datos = { socio_id: Number(socioId), vehiculo_id: vehiculoId, monto: Number(monto), fecha }
    const { error } = aportacion
      ? await supabase.from('aportacion').update(datos).eq('id', aportacion.id)
      : await supabase.from('aportacion').insert(datos)
    setGuardando(false)
    if (error) { setError(error.message); return }
    onGuardado()
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0, font: '500 16px Georgia, serif' }}>{aportacion ? 'Editar capital' : 'Asignar socio a esta unidad'}</h3>
        <select required value={socioId} onChange={(e) => setSocioId(e.target.value)} style={inputStyle}>
          <option value="">Socio…</option>
          {socios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <input required type="number" step="0.01" placeholder="Monto aportado" value={monto} onChange={(e) => setMonto(e.target.value)} style={inputStyle} />
        <input required type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputStyle} />
        {error && <div style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 10, background: '#f4f1ea', border: 'none', cursor: 'pointer' }}>Cancelar</button>
          <button type="submit" disabled={guardando} style={{ flex: 1, padding: 10, background: '#26302f', color: '#f3f1ec', border: 'none', cursor: 'pointer' }}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const inputStyle: React.CSSProperties = { padding: '8px 10px', border: '1px solid #ddd8d0', fontSize: 13.5, fontFamily: 'inherit' }
