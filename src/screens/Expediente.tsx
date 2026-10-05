import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCatalogos } from '../lib/catalogos'
import {
  mxn, porcentaje, fecha, hoyISO, diasDesde, km, numeroONull, etiqueta, legible,
  ESTADO_COMERCIAL, ESTADO_DOCUMENTAL, ESTADO_DOCUMENTO, TRANSMISION_LABEL,
} from '../lib/helpers'
import { useBorrador } from '../lib/useBorrador'
import { BUCKET_DOCUMENTOS, abrirArchivo, quitarArchivos, subirArchivo } from '../lib/archivos'
import { miniatura } from '../lib/miniatura'
import { Bitacora } from '../components/Bitacora'
import { Modal, FormBotones, PageHeader, Campo, Alerta, Cargando, Dato, EtiquetaBadge, Seccion, Badge } from '../components/Ui'
import type { VehiculoFicha, Gasto, Proveedor, TipoDocumento, Documento, Aportacion, Socio, CategoriaGasto } from '../types'

interface Compra { id: number; vehiculo_id: number; precio: number; comision: number; impuestos: number; iva: number }

type Pestana = 'resumen' | 'costos' | 'documentos' | 'publicacion' | 'socios' | 'historial'

export default function Expediente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { perfil } = useAuth()
  const { categorias } = useCatalogos()
  const [veh, setVeh] = useState<VehiculoFicha | null>(null)
  const [compra, setCompra] = useState<Compra | null>(null)
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [aportaciones, setAportaciones] = useState<Aportacion[]>([])
  const [socios, setSocios] = useState<Socio[]>([])
  const [cargando, setCargando] = useState(true)
  const [subasta, setSubasta] = useState<{ plataforma: string; fecha: string; lote: string | null } | null>(null)
  const [editandoDatos, setEditandoDatos] = useState(false)

  const esAdmin = perfil?.rol === 'admin'
  const esAdminOGerencia = esAdmin || perfil?.rol === 'gerencia'

  async function recargar() {
    if (!supabase || !id) return
    const [vehRes, compraRes, gastosRes, tiposRes, docsRes, aportRes, sociosRes] = await Promise.all([
      supabase.from('v_vehiculo_ficha').select('*').eq('id', id).maybeSingle(),
      supabase.from('compra').select('*').eq('vehiculo_id', id).maybeSingle(),
      supabase.from('gasto').select('*').eq('vehiculo_id', id).order('fecha', { ascending: false }),
      supabase.from('tipo_documento').select('*').eq('activo', true).order('orden'),
      supabase.from('documento').select('*').eq('vehiculo_id', id),
      supabase.from('aportacion').select('*').eq('vehiculo_id', id).order('fecha'),
      supabase.from('socio').select('*').order('nombre'),
    ])
    const ficha = vehRes.data as VehiculoFicha | null
    setVeh(ficha)
    if (ficha?.subasta_id) {
      const { data: sub } = await supabase.from('subasta').select('plataforma, fecha, lote').eq('id', ficha.subasta_id).maybeSingle()
      setSubasta(sub as { plataforma: string; fecha: string; lote: string | null } | null)
    } else setSubasta(null)
    setCompra(compraRes.data as Compra | null)
    setGastos((gastosRes.data ?? []) as Gasto[])
    setTiposDocumento((tiposRes.data ?? []) as TipoDocumento[])
    setDocumentos((docsRes.data ?? []) as Documento[])
    setAportaciones((aportRes.data ?? []) as Aportacion[])
    setSocios((sociosRes.data ?? []) as Socio[])
    setCargando(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setCargando(true); recargar() }, [id])

  if (cargando) return <Cargando />
  if (!veh) return <Alerta>No se encontró la unidad.</Alerta>

  const pestanas: { clave: Pestana; label: string; visible: boolean }[] = [
    { clave: 'resumen', label: 'Resumen', visible: true },
    { clave: 'costos', label: 'Compra y gastos', visible: esAdmin },
    { clave: 'documentos', label: 'Documentación', visible: true },
    { clave: 'publicacion', label: 'Publicación', visible: esAdminOGerencia },
    { clave: 'socios', label: 'Socios', visible: esAdmin },
    { clave: 'historial', label: 'Historial', visible: esAdmin },
  ]
  const visibles = pestanas.filter((p) => p.visible)
  const pedida = params.get('tab') as Pestana | null
  const pestana: Pestana = visibles.some((p) => p.clave === pedida) ? pedida! : 'resumen'

  const docsAplicables = tiposDocumento.filter((t) => documentos.find((d) => d.tipo_documento_id === t.id)?.activo ?? true)
  const docsListos = docsAplicables.filter((t) => documentos.find((d) => d.tipo_documento_id === t.id)?.estado === 'completo').length
  const dias = diasDesde(veh.fecha_compra)

  return (
    <div>
      <PageHeader
        volver={{ to: veh.estado_comercial === 'vendido' ? '/vendidos' : '/inventario', label: veh.estado_comercial === 'vendido' ? 'Vendidos' : 'Inventario' }}
        titulo={`${veh.marca} ${veh.modelo} ${veh.anio}`}
        descripcion={
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong>{veh.id_interno}</strong>
            <EtiquetaBadge etiqueta={etiqueta(ESTADO_COMERCIAL, veh.estado_comercial)} />
            <span>·</span>
            <span>{dias !== null ? `${dias} días en inventario` : 'Sin fecha de compra'}</span>
          </span>
        }
      />

      <div className="tabs">
        {visibles.map((p) => (
          <button
            key={p.clave}
            className={`tab${pestana === p.clave ? ' activa' : ''}`}
            onClick={() => setParams(p.clave === 'resumen' ? {} : { tab: p.clave }, { replace: true })}
          >
            {p.label}
            {p.clave === 'documentos' && docsAplicables.length > 0 && ` (${docsListos}/${docsAplicables.length})`}
          </button>
        ))}
      </div>

      {pestana === 'resumen' && (
        <>
          <div className="card">
            <div className="card-encabezado-acciones">
              <div className="card-titulo">Datos de la unidad</div>
              {esAdminOGerencia && (
                <button className="btn btn-secundario btn-chico" onClick={() => setEditandoDatos(true)}>Editar datos</button>
              )}
            </div>
            <div className="datos">
              <Dato label="Kilometraje de llegada" valor={km(veh.kilometraje)} />
              <Dato label="Kilometraje final" valor={km(veh.kilometraje_final)} />
              <Dato label="Color" valor={veh.color ?? '—'} />
              <Dato label="Transmisión" valor={veh.transmision ? (TRANSMISION_LABEL[veh.transmision] ?? legible(veh.transmision)) : '—'} />
              <Dato label="Fecha de compra" valor={fecha(veh.fecha_compra)} />
              {subasta && <Dato label="Subasta" valor={`${subasta.plataforma} · ${fecha(subasta.fecha)}${subasta.lote ? ` · lote ${subasta.lote}` : ''}`} />}
              {veh.torre && <Dato label="Torre" valor={veh.torre} />}
              {veh.stock_subasta && <Dato label="Stock (subasta)" valor={veh.stock_subasta} />}
              {veh.numero_motor && <Dato label="Número de motor" valor={veh.numero_motor} />}
              <Dato label="Documentación" valor={<EtiquetaBadge etiqueta={etiqueta(ESTADO_DOCUMENTAL, veh.estado_documental)} />} />
              {veh.version && <Dato label="Versión" valor={veh.version} />}
              {veh.vin && <Dato label="VIN" valor={veh.vin} />}
            </div>
            {veh.notas && (
              <div style={{ marginTop: 16 }}>
                <div className="dato-label">Notas</div>
                <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{veh.notas}</p>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-titulo">Números</div>
            <p className="card-sub">{esAdmin ? 'Costo total = compra + gastos. La utilidad se calcula contra el precio autorizado.' : 'Precio publicado de la unidad.'}</p>
            <div className="datos">
              <Dato label="Precio autorizado" valor={mxn(veh.precio_autorizado)} />
              {esAdmin && <Dato label="Precio mínimo" valor={mxn(veh.precio_minimo)} />}
              {esAdmin && <Dato label="Costo total" valor={mxn(veh.costo_total)} />}
              {esAdmin && <Dato label="Utilidad proyectada" valor={mxn(veh.utilidad)} />}
              {esAdmin && <Dato label="Margen" valor={porcentaje(veh.margen)} />}
            </div>
            {esAdmin && !compra && (
              <div style={{ marginTop: 16 }}>
                <Alerta tipo="aviso">
                  Esta unidad no tiene registrada su compra, así que el costo total solo incluye gastos.{' '}
                  <button className="btn-link" onClick={() => setParams({ tab: 'costos' }, { replace: true })}>Capturar compra</button>
                </Alerta>
              </div>
            )}
          </div>

          {editandoDatos && (
            <EditarDatosModal veh={veh} esAdmin={esAdmin} onClose={() => setEditandoDatos(false)}
              onGuardado={() => { setEditandoDatos(false); recargar() }} />
          )}

          {esAdminOGerencia && <EstadoEditor key={veh.id} veh={veh} onGuardado={recargar} />}

          {esAdmin && (
            <EliminarUnidad veh={veh} documentos={documentos} gastos={gastos} onEliminada={() => navigate('/inventario')} />
          )}
        </>
      )}

      {pestana === 'costos' && esAdmin && (
        <>
          <ComparativoEvaluacion vehiculoId={veh.id} compra={compra} gastos={gastos} precioAutorizado={veh.precio_autorizado} />
          <CompraForm key={`compra-${veh.id}`} vehiculoId={veh.id} compra={compra} onGuardado={recargar} />
          <Gastos vehiculoId={veh.id} gastos={gastos} categorias={categorias} onCambio={recargar} />
        </>
      )}

      {pestana === 'documentos' && (
        <DocumentoChecklist
          vehiculoId={veh.id}
          tiposDocumento={tiposDocumento}
          documentos={documentos}
          puedeEditar={esAdminOGerencia}
          onCambio={recargar}
        />
      )}

      {pestana === 'publicacion' && esAdminOGerencia && (
        <>
          {esAdmin && <MargenPublicacion costoTotal={veh.costo_total} precioAutorizado={veh.precio_autorizado} />}
          <PublicacionForm veh={veh} onGuardado={recargar} />
        </>
      )}

      {pestana === 'historial' && esAdmin && <Bitacora vehiculoId={veh.id} />}

      {pestana === 'socios' && esAdmin && (
        <CapitalSocios vehiculoId={veh.id} aportaciones={aportaciones} socios={socios} onCambio={recargar} />
      )}
    </div>
  )
}

/* ── Resumen: corregir los datos capturados en el alta ─────────────── */

interface SubastaOpcion { id: number; plataforma: string; fecha: string; lote: string | null }

function EditarDatosModal({ veh, esAdmin, onClose, onGuardado }: {
  veh: VehiculoFicha; esAdmin: boolean; onClose: () => void; onGuardado: () => void
}) {
  const texto = (v: string | number | null) => (v === null || v === undefined ? '' : String(v))
  const [f, setF] = useState({
    marca: veh.marca, modelo: veh.modelo, version: texto(veh.version), anio: texto(veh.anio),
    vin: texto(veh.vin), kilometraje: texto(veh.kilometraje), color: texto(veh.color),
    transmision: veh.transmision ?? '', numero_motor: texto(veh.numero_motor), torre: texto(veh.torre),
    stock_subasta: texto(veh.stock_subasta), fecha_compra: texto(veh.fecha_compra),
    subasta_id: texto(veh.subasta_id), notas: texto(veh.notas), precio_minimo: texto(veh.precio_minimo),
  })
  const [subastas, setSubastas] = useState<SubastaOpcion[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))

  // subasta es solo admin por RLS; gerencia no la ve ni la cambia.
  useEffect(() => {
    if (!supabase || !esAdmin) return
    supabase.from('subasta').select('id, plataforma, fecha, lote').order('fecha', { ascending: false })
      .then(({ data }) => setSubastas((data ?? []) as SubastaOpcion[]))
  }, [esAdmin])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    if (!f.marca.trim() || !f.modelo.trim()) { setError('Marca y modelo son obligatorios.'); return }
    const anio = Number(f.anio)
    if (!Number.isInteger(anio) || anio < 1950 || anio > 2100) { setError('Revisa el año.'); return }
    setGuardando(true)
    setError(null)
    const nulo = (v: string) => v.trim() || null
    const cambios: Record<string, unknown> = {
      marca: f.marca.trim(), modelo: f.modelo.trim(), version: nulo(f.version), anio,
      vin: f.vin.trim() ? f.vin.replace(/\s+/g, '').toUpperCase() : null,
      kilometraje: numeroONull(f.kilometraje), color: nulo(f.color), transmision: f.transmision || null,
      numero_motor: nulo(f.numero_motor), torre: nulo(f.torre), stock_subasta: nulo(f.stock_subasta),
      fecha_compra: f.fecha_compra || null, notas: nulo(f.notas),
    }
    if (esAdmin) {
      cambios.subasta_id = f.subasta_id ? Number(f.subasta_id) : null
      cambios.precio_minimo = numeroONull(f.precio_minimo)
    }
    const { error } = await supabase.from('vehiculo').update(cambios).eq('id', veh.id)
    setGuardando(false)
    if (error) { setError(error.code === '23505' ? 'Ya existe otra unidad con ese número de serie.' : error.message); return }
    onGuardado()
  }

  return (
    <Modal titulo="Editar datos de la unidad" subtitulo={veh.id_interno} ancho={720} onClose={onClose}>
      <form onSubmit={guardar}>
        <div className="form-grid">
          <Campo label="Marca"><input className="input" value={f.marca} onChange={(e) => set('marca', e.target.value)} /></Campo>
          <Campo label="Modelo"><input className="input" value={f.modelo} onChange={(e) => set('modelo', e.target.value)} /></Campo>
          <Campo label="Versión"><input className="input" value={f.version} onChange={(e) => set('version', e.target.value)} /></Campo>
          <Campo label="Año"><input className="input" type="number" value={f.anio} onChange={(e) => set('anio', e.target.value)} /></Campo>
          <Campo label="Número de serie (VIN)"><input className="input" value={f.vin} onChange={(e) => set('vin', e.target.value)} /></Campo>
          <Campo label="Número de motor"><input className="input" value={f.numero_motor} onChange={(e) => set('numero_motor', e.target.value)} /></Campo>
          <Campo label="Kilometraje de llegada"><input className="input" type="number" min={0} value={f.kilometraje} onChange={(e) => set('kilometraje', e.target.value)} /></Campo>
          <Campo label="Color"><input className="input" value={f.color} onChange={(e) => set('color', e.target.value)} /></Campo>
          <Campo label="Transmisión">
            <select className="select" value={f.transmision} onChange={(e) => set('transmision', e.target.value)}>
              <option value="">Sin capturar</option>
              {Object.entries(TRANSMISION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Campo>
          <Campo label="Fecha de compra"><input className="input" type="date" value={f.fecha_compra} onChange={(e) => set('fecha_compra', e.target.value)} /></Campo>
          {esAdmin && (
            <Campo label="Subasta">
              <select className="select" value={f.subasta_id} onChange={(e) => set('subasta_id', e.target.value)}>
                <option value="">Sin subasta</option>
                {subastas.map((s) => (
                  <option key={s.id} value={s.id}>{s.plataforma} · {fecha(s.fecha)}{s.lote ? ` · ${s.lote}` : ''}</option>
                ))}
              </select>
            </Campo>
          )}
          {esAdmin && (
            <Campo label="Precio mínimo" ayuda="Solo lo ve el administrador">
              <input className="input" type="number" min={0} value={f.precio_minimo} onChange={(e) => set('precio_minimo', e.target.value)} />
            </Campo>
          )}
          <Campo label="Torre"><input className="input" value={f.torre} onChange={(e) => set('torre', e.target.value)} /></Campo>
          <Campo label="Stock (subasta)"><input className="input" value={f.stock_subasta} onChange={(e) => set('stock_subasta', e.target.value)} /></Campo>
        </div>
        <div style={{ marginTop: 12 }}>
          <Campo label="Notas"><textarea className="input" rows={3} value={f.notas} onChange={(e) => set('notas', e.target.value)} /></Campo>
        </div>
        {error && <div style={{ marginTop: 12 }}><Alerta>{error}</Alerta></div>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}

/* ── Resumen: estado comercial / documental / km final ─────────────── */

// 'vendido' no se ofrece aquí: lo pone el cierre financiero en Ventas. Si se
// pusiera a mano, la unidad saltaría a Vendidos sin venta ni cierre.
const COMERCIAL_EDITABLES = ['no_publicado', 'publicado', 'en_consignacion', 'con_referidos', 'apartado']
const DOCUMENTAL_OPCIONES = ['incompleto', 'en_tramite', 'completo']

function EstadoEditor({ veh, onGuardado }: { veh: VehiculoFicha; onGuardado: () => void }) {
  const [estadoComercial, setEstadoComercial] = useState(veh.estado_comercial)
  const [estadoDocumental, setEstadoDocumental] = useState(veh.estado_documental)
  const [kilometrajeFinal, setKilometrajeFinal] = useState(veh.kilometraje_final !== null ? String(veh.kilometraje_final) : '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const vendido = veh.estado_comercial === 'vendido'
  const kmActual = veh.kilometraje_final !== null ? String(veh.kilometraje_final) : ''
  const huboCambios = veh.estado_comercial !== estadoComercial || veh.estado_documental !== estadoDocumental || kilometrajeFinal !== kmActual

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    setOk(false)
    const { error } = await supabase.from('vehiculo').update({
      estado_comercial: estadoComercial,
      estado_documental: estadoDocumental,
      kilometraje_final: numeroONull(kilometrajeFinal),
    }).eq('id', veh.id)
    setGuardando(false)
    if (error) { setError(error.message); return }
    setOk(true)
    onGuardado()
  }

  return (
    <form className="card" onSubmit={guardar}>
      <div className="card-titulo">Estado de la unidad</div>
      <p className="card-sub">La etapa del proceso y la ubicación se cambian desde En proceso y En venta.</p>
      <div className="form-grid">
        <Campo label="Estado comercial" ayuda={vendido ? 'Se vendió; se corrige desde Vendidos.' : 'Para marcarla vendida, registra la venta en En venta.'}>
          <select className="select" value={estadoComercial} disabled={vendido} onChange={(e) => setEstadoComercial(e.target.value)}>
            {(vendido ? ['vendido'] : COMERCIAL_EDITABLES).map((o) => <option key={o} value={o}>{ESTADO_COMERCIAL[o].label}</option>)}
          </select>
        </Campo>
        <Campo label="Documentación">
          <select className="select" value={estadoDocumental} onChange={(e) => setEstadoDocumental(e.target.value)}>
            {DOCUMENTAL_OPCIONES.map((o) => <option key={o} value={o}>{ESTADO_DOCUMENTAL[o].label}</option>)}
          </select>
        </Campo>
        <Campo label="Kilometraje final" ayuda="Al terminar la reparación (corrige el de llegada)">
          <input className="input" type="number" min={0} value={kilometrajeFinal} onChange={(e) => setKilometrajeFinal(e.target.value)} />
        </Campo>
      </div>
      <div className="form-acciones" style={{ alignItems: 'center' }}>
        {ok && !huboCambios && <span className="ok-inline">Guardado ✓</span>}
        {error && <span style={{ color: 'var(--danger)' }}>{error}</span>}
        <button type="submit" className="btn btn-primario" disabled={!huboCambios || guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </form>
  )
}

function EliminarUnidad({ veh, documentos, gastos, onEliminada }: { veh: VehiculoFicha; documentos: Documento[]; gastos: Gasto[]; onEliminada: () => void }) {
  const [abrir, setAbrir] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function eliminar() {
    if (!supabase) return
    setEliminando(true)
    setError(null)
    // Storage primero: Postgres no conoce los archivos y la cascada no los borra.
    // Los cobros no cascadean con la venta (FK sin acción): se quitan antes.
    const { error: errCobros } = await supabase.from('cobro').delete().eq('vehiculo_id', veh.id)
    if (errCobros) { setEliminando(false); setError(errCobros.message); return }
    await quitarArchivos([...documentos.map((d) => d.archivo_path), ...gastos.map((g) => g.comprobante_path)])
    const { error: errBorrar } = await supabase.from('vehiculo').delete().eq('id', veh.id)
    setEliminando(false)
    if (errBorrar) { setError(errBorrar.message); return }
    onEliminada()
  }

  return (
    <div className="card" style={{ borderColor: '#f6cdb8' }}>
      <div className="seccion-header" style={{ marginBottom: 0 }}>
        <div>
          <div className="card-titulo">Eliminar unidad</div>
          <p className="card-sub" style={{ margin: 0 }}>Borra la unidad y todo lo relacionado. No se puede deshacer.</p>
        </div>
        <button className="btn btn-peligro" onClick={() => setAbrir(true)}>Eliminar unidad</button>
      </div>

      {abrir && (
        <Modal titulo={`Eliminar ${veh.id_interno}`} onClose={() => setAbrir(false)}
          subtitulo="Se borran la compra, los gastos, los documentos y sus archivos, las aportaciones y, si ya se vendió, la venta y su cierre.">
          <div className="form">
            <Campo label={`Escribe ${veh.id_interno} para confirmar`}>
              <input className="input" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoFocus />
            </Campo>
            {error && <Alerta>{error}</Alerta>}
            <div className="form-acciones">
              <button type="button" className="btn btn-secundario" onClick={() => setAbrir(false)}>Cancelar</button>
              <button type="button" className="btn btn-peligro-solido" onClick={eliminar} disabled={confirmacion !== veh.id_interno || eliminando}>
                {eliminando ? 'Eliminando…' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ── Compra y gastos ───────────────────────────────────────────────── */

function CompraForm({ vehiculoId, compra, onGuardado }: { vehiculoId: number; compra: Compra | null; onGuardado: () => void }) {
  const inicial = {
    precio: compra ? String(compra.precio) : '',
    comision: compra ? String(compra.comision) : '5000',
    impuestos: compra ? String(compra.impuestos) : '0',
    iva: compra ? String(compra.iva) : '0',
  }
  const [form, setForm] = useState(inicial)
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const huboCambios = (Object.keys(inicial) as (keyof typeof inicial)[]).some((k) => inicial[k] !== form[k])
  const total = (Number(form.precio) || 0) + (Number(form.comision) || 0) + (Number(form.impuestos) || 0) + (Number(form.iva) || 0)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    setOk(false)
    const datos = {
      vehiculo_id: vehiculoId,
      precio: Number(form.precio),
      comision: Number(form.comision) || 0,
      impuestos: Number(form.impuestos) || 0,
      iva: Number(form.iva) || 0,
    }
    const { error } = compra
      ? await supabase.from('compra').update(datos).eq('id', compra.id)
      : await supabase.from('compra').insert(datos)
    setGuardando(false)
    if (error) { setError(error.message); return }
    setOk(true)
    onGuardado()
  }

  return (
    <form className="card" onSubmit={guardar}>
      <div className="card-titulo">Compra</div>
      <p className="card-sub">Costo de adquisición. Va aquí y nunca como gasto.</p>
      {!compra && <div style={{ marginBottom: 16 }}><Alerta tipo="aviso">Aún no se ha registrado la compra de esta unidad.</Alerta></div>}
      <div className="form-grid">
        <Campo label="Precio pagado"><input className="input" required type="number" step="0.01" min={0} value={form.precio} onChange={(e) => set('precio', e.target.value)} /></Campo>
        <Campo label="Comisión de subasta"><input className="input" type="number" step="0.01" min={0} value={form.comision} onChange={(e) => set('comision', e.target.value)} /></Campo>
        <Campo label="Impuestos"><input className="input" type="number" step="0.01" min={0} value={form.impuestos} onChange={(e) => set('impuestos', e.target.value)} /></Campo>
        <Campo label="IVA"><input className="input" type="number" step="0.01" min={0} value={form.iva} onChange={(e) => set('iva', e.target.value)} /></Campo>
      </div>
      <div className="form-acciones" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="texto-suave">Costo de adquisición: <strong style={{ color: 'var(--text)' }}>{mxn(total)}</strong></span>
        <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
          {ok && !huboCambios && <span className="ok-inline">Guardado ✓</span>}
          {error && <span style={{ color: 'var(--danger)' }}>{error}</span>}
          <button type="submit" className="btn btn-primario" disabled={!huboCambios || guardando}>
            {guardando ? 'Guardando…' : compra ? 'Guardar cambios' : 'Registrar compra'}
          </button>
        </span>
      </div>
    </form>
  )
}

interface EvaluacionCompra {
  costo_reparacion_estimado: number | null
  precio_venta_esperado: number | null
  techo_puja: number | null
}

/**
 * Lo que se calculó al evaluar la compra (Posibles ofertas) contra lo que va
 * pasando de verdad. Es lo que permite afinar la puja de las siguientes
 * subastas con números propios. Solo aparece si la unidad vino de "Adquirir".
 */
function ComparativoEvaluacion({ vehiculoId, compra, gastos, precioAutorizado }: {
  vehiculoId: number; compra: Compra | null; gastos: Gasto[]; precioAutorizado: number | null
}) {
  const [ev, setEv] = useState<EvaluacionCompra | null>(null)
  useEffect(() => {
    supabase?.from('evaluacion_puja').select('costo_reparacion_estimado, precio_venta_esperado, techo_puja')
      .eq('vehiculo_id', vehiculoId).limit(1).maybeSingle()
      .then(({ data }) => setEv(data as EvaluacionCompra | null))
  }, [vehiculoId])
  if (!ev) return null

  const gastado = gastos.reduce((a, g) => a + g.importe, 0)
  const filas: { concepto: string; estimado: number | null; real: number | null; mejorSiMenor: boolean }[] = [
    { concepto: 'Reparación', estimado: ev.costo_reparacion_estimado, real: gastado, mejorSiMenor: true },
    { concepto: 'Precio de compra (martillo)', estimado: ev.techo_puja, real: compra?.precio ?? null, mejorSiMenor: true },
    { concepto: 'Precio de venta', estimado: ev.precio_venta_esperado, real: precioAutorizado, mejorSiMenor: false },
  ]
  return (
    <div className="card">
      <div className="card-titulo">Estimado al comprar contra real</div>
      <p className="card-sub">Lo que se calculó en Posibles ofertas. En compra se compara contra el techo de puja; en venta, contra el precio autorizado actual.</p>
      <div className="tabla-wrap">
        <table className="tabla">
          <thead><tr><th>Concepto</th><th className="num">Estimado</th><th className="num">Real</th><th className="num">Diferencia</th></tr></thead>
          <tbody>
            {filas.map((f) => {
              const dif = f.estimado !== null && f.real !== null ? f.real - f.estimado : null
              const bien = dif === null ? null : f.mejorSiMenor ? dif <= 0 : dif >= 0
              return (
                <tr key={f.concepto}>
                  <td>{f.concepto}</td>
                  <td className="num">{mxn(f.estimado)}</td>
                  <td className="num">{mxn(f.real)}</td>
                  <td className={`num ${bien === null ? '' : bien ? 'texto-ok' : 'texto-peligro'}`}>
                    {dif === null ? '—' : `${dif > 0 ? '+' : dif < 0 ? '−' : ''}${mxn(Math.abs(dif))}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Gastos({ vehiculoId, gastos, categorias, onCambio }: {
  vehiculoId: number
  gastos: Gasto[]
  categorias: CategoriaGasto[]
  onCambio: () => void
}) {
  const [abrirNuevo, setAbrirNuevo] = useState(false)
  const [editando, setEditando] = useState<Gasto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const total = gastos.reduce((acc, g) => acc + g.importe, 0)
  const sinComprobante = gastos.filter((g) => !g.comprobante_path).length
  const pendientes = gastos.filter((g) => !g.pagado)
  const porPagar = pendientes.reduce((acc, g) => acc + g.importe, 0)
  const nombreCategoria = (catId: number) => categorias.find((c) => c.id === catId)?.nombre ?? '—'
  const nombreProveedor = (id: number | null) => (id === null ? '—' : proveedores.find((p) => p.id === id)?.nombre ?? '—')

  useEffect(() => {
    supabase?.from('proveedor').select('id, nombre, activo').order('nombre')
      .then(({ data }) => setProveedores((data ?? []) as Proveedor[]))
  }, [])

  async function eliminar(g: Gasto) {
    if (!supabase || !window.confirm(`¿Eliminar el gasto "${g.descripcion}" por ${mxn(g.importe)}?`)) return
    setError(null)
    const { error } = await supabase.from('gasto').delete().eq('id', g.id)
    if (error) { setError(error.message); return }
    await quitarArchivos([g.comprobante_path])
    onCambio()
  }

  async function marcarPagado(g: Gasto) {
    if (!supabase || !window.confirm(`¿Marcar como pagado "${g.descripcion}" por ${mxn(g.importe)} con fecha de hoy?`)) return
    setError(null)
    const { error } = await supabase.from('gasto').update({ pagado: true, fecha_pago: hoyISO(), fecha_vencimiento: null }).eq('id', g.id)
    if (error) { setError(error.message); return }
    onCambio()
  }

  async function ver(g: Gasto) {
    if (!g.comprobante_path) return
    const err = await abrirArchivo(g.comprobante_path)
    if (err) setError(`No se pudo abrir el comprobante: ${err}`)
  }

  return (
    <Seccion
      titulo="Gastos"
      descripcion={`${gastos.length} gastos · total ${mxn(total)}${pendientes.length ? ` · ${mxn(porPagar)} por pagar` : ''}${sinComprobante > 0 ? ` · ${sinComprobante} sin comprobante` : ''}`}
      acciones={<button className="btn btn-primario" onClick={() => setAbrirNuevo(true)}>+ Registrar gasto</button>}
    >
      {error && <div style={{ marginBottom: 12 }}><Alerta>{error}</Alerta></div>}
      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr><th>Gasto</th><th>Proveedor</th><th>Comprobante</th><th>Pago</th><th className="num">Importe</th><th></th></tr>
          </thead>
          <tbody>
            {gastos.map((g) => (
              <tr key={g.id}>
                <td>
                  {g.descripcion}
                  <span className="unidad-folio">{fecha(g.fecha)} · {nombreCategoria(g.categoria_id)}</span>
                </td>
                <td className="texto-suave">{nombreProveedor(g.proveedor_id)}</td>
                <td>
                  {g.comprobante_path
                    ? <button className="btn-link" onClick={() => ver(g)}>Ver ✓</button>
                    : <span className="texto-aviso">Falta</span>}
                </td>
                <td>
                  {g.pagado
                    ? <Badge tono="ok">Pagado</Badge>
                    : <>
                      <Badge tono="aviso">Por pagar</Badge>
                      {g.fecha_vencimiento && <span className="unidad-folio">vence {fecha(g.fecha_vencimiento)}</span>}
                    </>}
                </td>
                <td className="num">{mxn(g.importe)}</td>
                <td className="acciones-celda">
                  {!g.pagado && <button className="btn-link" onClick={() => marcarPagado(g)}>Marcar pagado</button>}
                  <button className="btn-link" onClick={() => setEditando(g)}>Editar</button>
                  <button className="btn-link peligro" onClick={() => eliminar(g)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {gastos.length === 0 && <tr><td colSpan={6} className="vacio">Sin gastos registrados todavía.</td></tr>}
          </tbody>
        </table>
      </div>

      {(abrirNuevo || editando) && (
        <GastoModal
          vehiculoId={vehiculoId}
          gasto={editando}
          categorias={categorias}
          proveedores={proveedores}
          onClose={() => { setAbrirNuevo(false); setEditando(null) }}
          onGuardado={() => { setAbrirNuevo(false); setEditando(null); onCambio() }}
        />
      )}
    </Seccion>
  )
}

function GastoModal({ vehiculoId, gasto, categorias, proveedores, onClose, onGuardado }: {
  vehiculoId: number
  gasto: Gasto | null
  categorias: CategoriaGasto[]
  proveedores: Proveedor[]
  onClose: () => void
  onGuardado: () => void
}) {
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:gasto:${vehiculoId}:${gasto?.id ?? 'nuevo'}`, {
    descripcion: gasto?.descripcion ?? '',
    categoriaId: gasto ? String(gasto.categoria_id) : '',
    proveedorId: gasto?.proveedor_id ? String(gasto.proveedor_id) : '',
    importe: gasto ? String(gasto.importe) : '',
    fecha: gasto?.fecha ?? hoyISO(),
    pagado: gasto ? gasto.pagado : true,
    fechaVencimiento: gasto?.fecha_vencimiento ?? '',
  })
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))
  // El archivo no cabe en el borrador de localStorage: se elige al final.
  const [archivo, setArchivo] = useState<File | null>(null)
  const [vista, setVista] = useState<string | null>(null)
  const [quitarActual, setQuitarActual] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tieneActual = Boolean(gasto?.comprobante_path) && !quitarActual

  async function elegir(f: File | null) {
    setArchivo(f)
    setVista(f ? await miniatura(f) : null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    let rutaNueva: string | null = null
    if (archivo) {
      try {
        rutaNueva = await subirArchivo(vehiculoId, 'gastos', archivo, archivo.name)
      } catch (err) {
        setGuardando(false)
        setError((err as Error).message)
        return
      }
    }
    const anterior = gasto?.comprobante_path ?? null
    const ruta = rutaNueva ?? (quitarActual ? null : anterior)
    const datos = {
      vehiculo_id: vehiculoId,
      categoria_id: Number(form.categoriaId),
      proveedor_id: form.proveedorId ? Number(form.proveedorId) : null,
      descripcion: form.descripcion.trim(),
      importe: Number(form.importe),
      fecha: form.fecha,
      comprobante_path: ruta,
      pagado: form.pagado,
      // Si ya estaba pagado se respeta su fecha de pago; si se marca pagado aquí, se toma la fecha del gasto.
      fecha_pago: form.pagado ? (gasto?.pagado ? gasto.fecha_pago : null) ?? form.fecha : null,
      fecha_vencimiento: form.pagado ? null : form.fechaVencimiento || null,
    }
    const { error } = gasto
      ? await supabase.from('gasto').update(datos).eq('id', gasto.id)
      : await supabase.from('gasto').insert({ ...datos, pagador_tipo: 'empresa' })
    if (error) {
      await quitarArchivos([rutaNueva])  // no dejar un archivo suelto en Storage
      setGuardando(false)
      setError(error.message)
      return
    }
    if (anterior && anterior !== ruta) await quitarArchivos([anterior])
    setGuardando(false)
    limpiarBorrador()
    onGuardado()
  }

  return (
    <Modal titulo={gasto ? 'Editar gasto' : 'Registrar gasto'} ancho={560} onClose={onClose}>
      <form onSubmit={onSubmit} className="form">
        <Campo label="Descripción"><input className="input" required value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} autoFocus /></Campo>
        <div className="form-grid">
          <Campo label="Categoría">
            <select className="select" required value={form.categoriaId} onChange={(e) => set('categoriaId', e.target.value)}>
              <option value="">Elige una categoría…</option>
              {categorias.filter((c) => c.activo || String(c.id) === form.categoriaId).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Proveedor">
            <select className="select" value={form.proveedorId} onChange={(e) => set('proveedorId', e.target.value)}>
              <option value="">Sin proveedor</option>
              {proveedores.filter((p) => p.activo || String(p.id) === form.proveedorId).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Importe"><input className="input" required type="number" step="0.01" min={0} value={form.importe} onChange={(e) => set('importe', e.target.value)} /></Campo>
          <Campo label="Fecha"><input className="input" required type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} /></Campo>
        </div>
        <div className="form-grid">
          <Campo label="¿Ya se pagó?">
            <label className="check" style={{ minHeight: 42 }}>
              <input type="checkbox" checked={form.pagado} onChange={(e) => set('pagado', e.target.checked)} />
              {form.pagado ? 'Sí, ya está pagado' : 'No, queda pendiente'}
            </label>
          </Campo>
          {!form.pagado && (
            <Campo label="Fecha límite de pago" ayuda="Aparece en Por pagar">
              <input className="input" type="date" value={form.fechaVencimiento} onChange={(e) => set('fechaVencimiento', e.target.value)} />
            </Campo>
          )}
        </div>
        <Campo label="Comprobante (foto del ticket o factura)">
          {archivo ? (
            <div className="doc-archivo">
              {vista ? <img className="miniatura" src={vista} alt="" /> : <span className="miniatura">PDF</span>}
              <span>{archivo.name}</span>
              <button type="button" className="btn-link peligro" onClick={() => elegir(null)}>Quitar</button>
            </div>
          ) : tieneActual ? (
            <div className="doc-archivo">
              <button type="button" className="btn-link" onClick={() => abrirArchivo(gasto!.comprobante_path!)}>Ver comprobante actual</button>
              <button type="button" className="btn-link peligro" onClick={() => setQuitarActual(true)}>Quitar</button>
              <label className="btn-link">Reemplazar<input type="file" hidden accept="image/*,application/pdf" onChange={(e) => elegir(e.target.files?.[0] ?? null)} /></label>
            </div>
          ) : (
            <input className="input" type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => elegir(e.target.files?.[0] ?? null)} />
          )}
        </Campo>
        {error && <Alerta>{error}</Alerta>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}

/* ── Documentación ─────────────────────────────────────────────────── */

/**
 * Cada categoría se activa o desactiva por unidad (documento.activo): una
 * desactivada no cuenta como faltante. El FK de documento impide borrar una
 * categoría que ya tiene archivos.
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

  function documentoDe(tipoId: number) {
    return documentos.find((d) => d.tipo_documento_id === tipoId)
  }

  async function actualizarDocumento(tipo: TipoDocumento, cambios: Partial<Documento>) {
    if (!supabase) return
    setError(null)
    setOcupadoId(tipo.id)
    const existente = documentoDe(tipo.id)
    const { error } = existente
      ? await supabase.from('documento').update(cambios).eq('id', existente.id)
      : await supabase.from('documento').insert({ vehiculo_id: vehiculoId, tipo_documento_id: tipo.id, estado: 'faltante', ...cambios })
    setOcupadoId(null)
    if (error) { setError(`No se pudo actualizar "${tipo.nombre}": ${error.message}`); return }
    onCambio()
  }

  async function subirDocumento(tipo: TipoDocumento, archivo: File) {
    if (!supabase) return
    setError(null)
    setOcupadoId(tipo.id)
    let ruta: string
    try {
      ruta = await subirArchivo(vehiculoId, String(tipo.id), archivo, archivo.name)
    } catch (err) {
      setOcupadoId(null)
      setError((err as Error).message)
      return
    }
    setOcupadoId(null)
    await actualizarDocumento(tipo, { estado: 'completo', archivo_path: ruta, fecha_obtencion: hoyISO() })
  }

  async function verArchivo(doc: Documento) {
    if (!supabase || !doc.archivo_path) return
    const err = await abrirArchivo(doc.archivo_path)
    if (err) setError(`No se pudo abrir el archivo: ${err}`)
  }

  async function quitarArchivo(tipo: TipoDocumento, doc: Documento) {
    if (!supabase || !doc.archivo_path || !window.confirm(`¿Quitar el archivo de "${tipo.nombre}"?`)) return
    setError(null)
    setOcupadoId(tipo.id)
    const { error: errStorage } = await supabase.storage.from(BUCKET_DOCUMENTOS).remove([doc.archivo_path])
    if (errStorage) { setOcupadoId(null); setError(`No se pudo quitar el archivo: ${errStorage.message}`); return }
    setOcupadoId(null)
    await actualizarDocumento(tipo, { archivo_path: null, estado: 'faltante', fecha_obtencion: null })
  }

  async function crearCategoria(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !nuevaCategoria.trim()) return
    setCreandoCategoria(true)
    setError(null)
    // NFD separa la letra base de su acento; el rango U+0300-U+036F quita
    // solo las marcas combinantes.
    const clave = nuevaCategoria.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
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
    if (!supabase || !window.confirm(`¿Eliminar la categoría "${tipo.nombre}" de todas las unidades?`)) return
    setError(null)
    setOcupadoId(tipo.id)
    const { error: errBorrar } = await supabase.from('tipo_documento').delete().eq('id', tipo.id)
    setOcupadoId(null)
    if (errBorrar) { setError(`No se puede eliminar "${tipo.nombre}": ya tiene documentos registrados en alguna unidad.`); return }
    onCambio()
  }

  return (
    <div>
      <p className="texto-suave" style={{ marginTop: 0 }}>
        Desmarca "Aplica" en los documentos que esta unidad no necesita; así no cuentan como faltantes.
      </p>
      {error && <div style={{ marginBottom: 12 }}><Alerta>{error}</Alerta></div>}

      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr><th style={{ width: 70 }}>Aplica</th><th>Documento</th><th>Estado</th><th className="acciones-celda">Archivo</th></tr>
          </thead>
          <tbody>
            {tiposDocumento.map((tipo) => {
              const doc = documentoDe(tipo.id)
              const activo = doc?.activo ?? true
              const estado = doc?.estado ?? 'faltante'
              const ocupado = ocupadoId === tipo.id
              return (
                <tr key={tipo.id} className={ocupado ? 'ocupado' : activo ? '' : 'inactivo'}>
                  <td>
                    <label className="check">
                      <input type="checkbox" checked={activo} disabled={!puedeEditar || ocupado}
                        onChange={(e) => actualizarDocumento(tipo, { activo: e.target.checked })} />
                    </label>
                  </td>
                  <td>
                    {editandoId === tipo.id ? (
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input className="input input-chico" autoFocus value={nombreEditado}
                          onChange={(e) => setNombreEditado(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') guardarNombre(tipo); if (e.key === 'Escape') setEditandoId(null) }} />
                        <button className="btn-link" onClick={() => guardarNombre(tipo)}>Guardar</button>
                        <button className="btn-link" onClick={() => setEditandoId(null)}>Cancelar</button>
                      </span>
                    ) : (
                      <>
                        <span style={{ fontWeight: 500 }}>{tipo.nombre}</span>
                        {puedeEditar && (
                          <span style={{ marginLeft: 6 }}>
                            <button className="btn-link" onClick={() => { setEditandoId(tipo.id); setNombreEditado(tipo.nombre) }}>Renombrar</button>
                            <button className="btn-link peligro" onClick={() => eliminarCategoria(tipo)} disabled={ocupado}>Eliminar</button>
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td>
                    {!activo ? <span className="texto-muted">No aplica</span> : puedeEditar ? (
                      <select className="select select-chico" value={estado} disabled={ocupado}
                        onChange={(e) => {
                          const nuevo = e.target.value as Documento['estado']
                          actualizarDocumento(tipo, { estado: nuevo, fecha_obtencion: nuevo === 'completo' ? hoyISO() : null })
                        }}>
                        <option value="faltante">Falta</option>
                        <option value="en_tramite">En trámite</option>
                        <option value="completo">Listo</option>
                      </select>
                    ) : <EtiquetaBadge etiqueta={etiqueta(ESTADO_DOCUMENTO, estado)} />}
                  </td>
                  <td className="acciones-celda">
                    {!activo ? <span className="texto-muted">—</span> : doc?.archivo_path ? (
                      <>
                        <button className="btn-link" onClick={() => verArchivo(doc)}>Ver archivo</button>
                        {puedeEditar && <button className="btn-link peligro" onClick={() => quitarArchivo(tipo, doc)} disabled={ocupado}>Quitar</button>}
                      </>
                    ) : puedeEditar ? (
                      <label className="btn btn-secundario btn-chico" style={{ cursor: ocupado ? 'default' : 'pointer' }}>
                        {ocupado ? 'Subiendo…' : 'Subir archivo'}
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp" disabled={ocupado} style={{ display: 'none' }}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) subirDocumento(tipo, f); e.target.value = '' }} />
                      </label>
                    ) : <span className="texto-muted">—</span>}
                  </td>
                </tr>
              )
            })}
            {tiposDocumento.length === 0 && <tr><td colSpan={4} className="vacio">No hay categorías de documentos.</td></tr>}
          </tbody>
        </table>
      </div>

      {puedeEditar && (
        <form onSubmit={crearCategoria} style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <input className="input" placeholder="Nombre de una nueva categoría…" value={nuevaCategoria}
            onChange={(e) => setNuevaCategoria(e.target.value)} style={{ maxWidth: 320 }} />
          <button type="submit" className="btn btn-secundario" disabled={creandoCategoria || !nuevaCategoria.trim()}>+ Agregar categoría</button>
        </form>
      )}
    </div>
  )
}

/* ── Publicación ───────────────────────────────────────────────────── */

/** Valor transitorio (no se guarda): el precio de mercado cambia después de la reparación. */
function MargenPublicacion({ costoTotal, precioAutorizado }: { costoTotal: number | null; precioAutorizado: number | null }) {
  const [precioMercado, setPrecioMercado] = useState(precioAutorizado !== null ? String(precioAutorizado) : '')
  const precio = Number(precioMercado) || 0
  const costo = costoTotal ?? 0
  const utilidad = precio > 0 ? precio - costo : null
  const margen = precio > 0 ? (precio - costo) / precio : null

  return (
    <div className="card">
      <div className="card-titulo">¿A cuánto venderla?</div>
      <p className="card-sub">Escribe un precio para ver la utilidad y el margen contra el costo real. No se guarda; el precio autorizado se fija en En venta.</p>
      <div className="datos" style={{ alignItems: 'end' }}>
        <Campo label="Precio de mercado">
          <input className="input" type="number" step="0.01" min={0} value={precioMercado} onChange={(e) => setPrecioMercado(e.target.value)} />
        </Campo>
        <Dato label="Costo total" valor={mxn(costo)} />
        <Dato label="Utilidad" valor={<span style={{ color: utilidad !== null && utilidad < 0 ? 'var(--danger)' : undefined }}>{utilidad !== null ? mxn(utilidad) : '—'}</span>} />
        <Dato label="Margen" valor={margen !== null ? porcentaje(margen) : '—'} />
      </div>
    </div>
  )
}

/** Lo que ve el comisionista en su catálogo. */
function PublicacionForm({ veh, onGuardado }: { veh: VehiculoFicha; onGuardado: () => void }) {
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:publicacion:${veh.id}`, {
    descripcion: veh.descripcion_breve ?? '',
    indicaciones: veh.indicaciones_comisionista ?? '',
    comision: veh.comision_ofrecida !== null ? String(veh.comision_ofrecida) : '',
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const comisionActual = veh.comision_ofrecida !== null ? String(veh.comision_ofrecida) : ''
  const huboCambios = form.descripcion !== (veh.descripcion_breve ?? '') || form.indicaciones !== (veh.indicaciones_comisionista ?? '') || form.comision !== comisionActual

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    setOk(false)
    const { error } = await supabase.from('vehiculo').update({
      descripcion_breve: form.descripcion.trim() || null,
      indicaciones_comisionista: form.indicaciones.trim() || null,
      comision_ofrecida: numeroONull(form.comision),
    }).eq('id', veh.id)
    setGuardando(false)
    if (error) { setError(error.message); return }
    setOk(true)
    limpiarBorrador()
    onGuardado()
  }

  return (
    <form className="card" onSubmit={guardar}>
      <div className="card-titulo">Información para comisionistas</div>
      <p className="card-sub">Aparece en el catálogo del portal de comisionistas cuando la unidad está lista para venta.</p>
      <div className="form">
        <Campo label="Descripción breve">
          <textarea className="textarea" rows={2} value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} />
        </Campo>
        <Campo label="Indicaciones para comisionistas">
          <textarea className="textarea" rows={2} value={form.indicaciones} onChange={(e) => set('indicaciones', e.target.value)} />
        </Campo>
        <div className="form-grid">
          <Campo label="Comisión ofrecida"><input className="input" type="number" step="0.01" min={0} value={form.comision} onChange={(e) => set('comision', e.target.value)} /></Campo>
        </div>
      </div>
      <div className="form-acciones" style={{ alignItems: 'center' }}>
        {ok && !huboCambios && <span className="ok-inline">Guardado ✓</span>}
        {error && <span style={{ color: 'var(--danger)' }}>{error}</span>}
        <button type="submit" className="btn btn-primario" disabled={!huboCambios || guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </form>
  )
}

/* ── Socios ────────────────────────────────────────────────────────── */

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
  const nombreSocio = (sid: number) => socios.find((s) => s.id === sid)?.nombre ?? '—'

  async function eliminar(a: Aportacion) {
    if (!supabase || !window.confirm(`¿Quitar la aportación de ${nombreSocio(a.socio_id)} por ${mxn(a.monto)}?`)) return
    setError(null)
    const { error } = await supabase.from('aportacion').delete().eq('id', a.id)
    if (error) { setError(error.message); return }
    onCambio()
  }

  return (
    <Seccion
      titulo="Capital de socios en esta unidad"
      descripcion={`Total aportado: ${mxn(total)}. El % define cómo se reparte la utilidad al cerrar la venta.`}
      acciones={<button className="btn btn-primario" onClick={() => setAbrirForm(true)}>+ Asignar socio</button>}
    >
      {error && <div style={{ marginBottom: 12 }}><Alerta>{error}</Alerta></div>}
      <div className="tabla-wrap">
        <table className="tabla">
          <thead><tr><th>Socio</th><th>Fecha</th><th className="num">Monto</th><th className="num">Participación</th><th></th></tr></thead>
          <tbody>
            {aportaciones.map((a) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 500 }}>{nombreSocio(a.socio_id)}</td>
                <td>{fecha(a.fecha)}</td>
                <td className="num">{mxn(a.monto)}</td>
                <td className="num">{total > 0 ? `${((a.monto / total) * 100).toFixed(1)}%` : '—'}</td>
                <td className="acciones-celda">
                  <button className="btn-link" onClick={() => setEditando(a)}>Editar</button>
                  <button className="btn-link peligro" onClick={() => eliminar(a)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {aportaciones.length === 0 && <tr><td colSpan={5} className="vacio">Ningún socio tiene capital asignado a esta unidad.</td></tr>}
          </tbody>
        </table>
      </div>

      {(abrirForm || editando) && (
        <AportacionVehiculoModal
          vehiculoId={vehiculoId}
          socios={socios}
          aportacion={editando}
          onClose={() => { setAbrirForm(false); setEditando(null) }}
          onGuardado={() => { setAbrirForm(false); setEditando(null); onCambio() }}
        />
      )}
    </Seccion>
  )
}

function AportacionVehiculoModal({ vehiculoId, socios, aportacion, onClose, onGuardado }: {
  vehiculoId: number
  socios: Socio[]
  aportacion: Aportacion | null
  onClose: () => void
  onGuardado: () => void
}) {
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:aportacion-vehiculo:${vehiculoId}:${aportacion?.id ?? 'nueva'}`, {
    socioId: aportacion ? String(aportacion.socio_id) : '',
    monto: aportacion ? String(aportacion.monto) : '',
    fecha: aportacion?.fecha ?? hoyISO(),
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    const datos = { socio_id: Number(form.socioId), vehiculo_id: vehiculoId, monto: Number(form.monto), fecha: form.fecha }
    const { error } = aportacion
      ? await supabase.from('aportacion').update(datos).eq('id', aportacion.id)
      : await supabase.from('aportacion').insert(datos)
    setGuardando(false)
    if (error) { setError(error.message); return }
    limpiarBorrador()
    onGuardado()
  }

  return (
    <Modal titulo={aportacion ? 'Editar aportación' : 'Asignar socio a esta unidad'} onClose={onClose}>
      <form onSubmit={onSubmit} className="form">
        <Campo label="Socio">
          <select className="select" required value={form.socioId} onChange={(e) => set('socioId', e.target.value)}>
            <option value="">Elige un socio…</option>
            {socios.filter((s) => s.activo || String(s.id) === form.socioId).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </Campo>
        <div className="form-grid">
          <Campo label="Monto aportado"><input className="input" required type="number" step="0.01" min={0} value={form.monto} onChange={(e) => set('monto', e.target.value)} /></Campo>
          <Campo label="Fecha"><input className="input" required type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} /></Campo>
        </div>
        {error && <Alerta>{error}</Alerta>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}
