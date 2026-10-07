import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useParametros } from '../lib/parametros'
import { mxn, km, fecha, TRANSMISION_LABEL } from '../lib/helpers'
import { buscarListados, descargarListado, type ArchivoListado } from '../lib/prosubastas'
import { importarListado, type ResultadoImportacion } from '../lib/catalogoSubastas'
import { dropboxConectado, listarConCache, torreDeCarpeta } from '../lib/dropbox'
import { PageHeader, Modal, Campo, Alerta, Cargando, Badge, Kpi } from '../components/Ui'
import { ConectarDropbox, FotosDropboxModal } from '../components/FotosDropbox'
import type { Subasta, SubastaListado, SubastaUnidad, EvaluacionPuja } from '../types'

type EvaluacionLigada = Pick<EvaluacionPuja, 'id' | 'subasta_unidad_id' | 'resultado' | 'vehiculo_id'>

/**
 * Etapa 0 del ciclo: el catálogo de lo que sale a subasta. Se importan los
 * listados de Prosubastas (todas las empresas de un patio o de una fecha) y
 * se guardan TODAS sus unidades como registro histórico. De aquí, "Me
 * interesa" las pasa a Posibles ofertas para evaluar la puja.
 */
export default function Subastas() {
  const navigate = useNavigate()
  const { margen_deseado } = useParametros()
  const [subastas, setSubastas] = useState<Subasta[]>([])
  const [conteos, setConteos] = useState<Record<number, number>>({})
  const [subastaId, setSubastaId] = useState<number | null>(null)
  const [listados, setListados] = useState<SubastaListado[]>([])
  const [unidades, setUnidades] = useState<SubastaUnidad[]>([])
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionLigada[]>([])
  const [cargando, setCargando] = useState(true)
  const [importando, setImportando] = useState(false)
  const [empresa, setEmpresa] = useState<number | 'todas'>('todas')
  const [filtro, setFiltro] = useState('')
  const [historico, setHistorico] = useState('')
  const [viendoFotos, setViendoFotos] = useState<SubastaUnidad | null>(null)
  const [enlaceFotos, setEnlaceFotos] = useState('')
  const [vinculando, setVinculando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  async function cargarSubastas(seleccion?: number | null) {
    if (!supabase) return
    const [s, u] = await Promise.all([
      supabase.from('subasta').select('*').order('fecha', { ascending: false }),
      supabase.from('subasta_unidad').select('subasta_id'),
    ])
    const lista = (s.data ?? []) as Subasta[]
    const c: Record<number, number> = {}
    for (const x of (u.data ?? []) as { subasta_id: number }[]) c[x.subasta_id] = (c[x.subasta_id] ?? 0) + 1
    setSubastas(lista)
    setConteos(c)
    const pedido = seleccion !== undefined ? seleccion : subastaId
    const id = lista.some((x) => x.id === pedido) ? pedido! : (lista.find((x) => c[x.id])?.id ?? lista[0]?.id ?? null)
    setSubastaId(id)
    setCargando(false)
  }

  async function cargarDetalle(id: number) {
    if (!supabase) return
    const [l, u] = await Promise.all([
      supabase.from('subasta_listado').select('*').eq('subasta_id', id).order('orden'),
      supabase.from('subasta_unidad').select('*').eq('subasta_id', id).order('id'),
    ])
    const us = (u.data ?? []) as SubastaUnidad[]
    setListados((l.data ?? []) as SubastaListado[])
    setUnidades(us)
    if (us.length) {
      const { data } = await supabase.from('evaluacion_puja').select('id, subasta_unidad_id, resultado, vehiculo_id').in('subasta_unidad_id', us.map((x) => x.id))
      setEvaluaciones((data ?? []) as EvaluacionLigada[])
    } else setEvaluaciones([])
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargarSubastas() }, [])
  useEffect(() => {
    if (subastaId) cargarDetalle(subastaId)
    setEmpresa('todas')
    setFiltro('')
    setEnlaceFotos(subastas.find((s) => s.id === subastaId)?.enlace_fotos ?? '')
  }, [subastaId])  // eslint-disable-line react-hooks/exhaustive-deps

  const subasta = subastas.find((s) => s.id === subastaId) ?? null
  const evaluacionDe = (u: SubastaUnidad) => evaluaciones.find((e) => e.subasta_unidad_id === u.id)
  const q = filtro.trim().toLowerCase()
  const visibles = useMemo(() => unidades.filter((u) =>
    (empresa === 'todas' || u.listado_id === empresa)
    && (!q || `${u.torre} ${u.stock ?? ''} ${u.vin ?? ''} ${u.marca} ${u.modelo} ${u.version ?? ''} ${u.anio ?? ''} ${u.color ?? ''}`.toLowerCase().includes(q))), [unidades, empresa, q])

  async function meInteresa(u: SubastaUnidad) {
    if (!supabase) return
    setError(null)
    const { error: err } = await supabase.from('evaluacion_puja').insert({
      subasta_id: u.subasta_id, subasta_unidad_id: u.id,
      marca: u.marca, modelo: u.modelo, anio: u.anio ?? new Date().getFullYear(), version: u.version,
      torre: u.torre, stock: u.stock, vin: u.vin, color: u.color, puertas: u.puertas,
      kilometraje_llegada: u.kilometraje, equipamiento: u.equipamiento, transmision: u.transmision,
      vendedor: u.vendedor, valor_factura: u.valor_factura, fecha_factura: u.fecha_factura, info_documentos: u.info_documentos,
      costo_reparacion_estimado: 0, precio_venta_esperado: 0, margen_deseado: margen_deseado / 100,
    })
    if (err) { setError(err.message); return }
    if (subastaId) cargarDetalle(subastaId)
  }

  async function guardarEnlaceFotos() {
    if (!supabase || !subasta) return
    const { error: err } = await supabase.from('subasta').update({ enlace_fotos: enlaceFotos.trim() || null }).eq('id', subasta.id)
    if (err) { setError(err.message); return }
    await cargarSubastas(subasta.id)
    setAviso('Enlace de fotos guardado.')
  }

  /**
   * Liga cada empresa con su carpeta del Dropbox del patio ("01 FC") y cada
   * unidad con la de su torre ("FC 01"), confirmando con el stock, y anota
   * cuántas fotos tiene. Las fotos no se copian: se ven directo de Dropbox.
   */
  async function vincularFotos() {
    if (!supabase || !subasta?.enlace_fotos) return
    setError(null)
    setAviso(null)
    try {
      setVinculando('Leyendo carpetas…')
      const raiz = (await listarConCache(subasta.enlace_fotos, '')).filter((e) => e.tipo === 'folder')
      let ligadas = 0
      let sinCarpeta = 0
      let otroStock = 0
      for (const l of listados) {
        const carpeta = raiz.find((c) => c.nombre.toUpperCase().split(/\s+/).includes(l.codigo.toUpperCase()))
        await supabase.from('subasta_listado').update({ carpeta_fotos: carpeta?.ruta ?? null }).eq('id', l.id)
        const deEmpresa = unidades.filter((u) => u.listado_id === l.id)
        if (!carpeta) { sinCarpeta += deEmpresa.length; continue }
        const sub = (await listarConCache(subasta.enlace_fotos, carpeta.ruta)).filter((e) => e.tipo === 'folder')
        for (let i = 0; i < deEmpresa.length; i += 6) {
          setVinculando(`${l.codigo}: ${Math.min(i + 6, deEmpresa.length)} de ${deEmpresa.length}…`)
          await Promise.all(deEmpresa.slice(i, i + 6).map(async (u) => {
            const c = sub.find((x) => torreDeCarpeta(x.nombre).toUpperCase() === u.torre.toUpperCase())
            if (!c) { sinCarpeta++; return supabase!.from('subasta_unidad').update({ carpeta_fotos: null, fotos_total: null }).eq('id', u.id) }
            const archivos = (await listarConCache(subasta.enlace_fotos!, c.ruta)).filter((a) => a.tipo === 'file')
            if (u.stock && !archivos.some((a) => a.nombre.includes(u.stock!))) {
              otroStock++
              return supabase!.from('subasta_unidad').update({ carpeta_fotos: null, fotos_total: null }).eq('id', u.id)
            }
            ligadas++
            return supabase!.from('subasta_unidad').update({
              carpeta_fotos: c.ruta, fotos_total: archivos.filter((a) => /\.(jpe?g|png|webp)$/i.test(a.nombre)).length,
            }).eq('id', u.id)
          }))
        }
      }
      setAviso(`Fotos ligadas: ${ligadas} unidades.${sinCarpeta ? ` ${sinCarpeta} sin carpeta en ese Dropbox.` : ''}${otroStock ? ` ${otroStock} con carpeta de otro stock (¿es el Dropbox de otro patio?).` : ''}`)
    } catch (e) {
      setError(`No se pudieron ligar las fotos: ${(e as Error).message}`)
    }
    setVinculando(null)
    if (subastaId) cargarDetalle(subastaId)
  }

  async function eliminarSubasta() {
    if (!supabase || !subasta) return
    if (!window.confirm(`¿Eliminar la subasta ${subasta.plataforma} · ${fecha(subasta.fecha)} · ${subasta.patio_origen ?? ''} con sus ${unidades.length} unidades del catálogo?`)) return
    setError(null)
    // Orden: unidades → listados → subasta (FK sin borrado en cascada).
    for (const [tabla, campo] of [['subasta_unidad', 'subasta_id'], ['subasta_listado', 'subasta_id'], ['subasta', 'id']] as const) {
      const { error: err } = await supabase.from(tabla).delete().eq(campo, subasta.id)
      if (err) {
        setError(err.code === '23503'
          ? 'No se puede eliminar: hay unidades de esta subasta en Posibles ofertas o compradas. Quítalas de ahí primero.'
          : err.message)
        if (subastaId) cargarDetalle(subastaId)
        return
      }
    }
    cargarSubastas(null)
  }

  if (cargando) return <Cargando />

  const conFotos = unidades.filter((u) => u.carpeta_fotos).length

  return (
    <div>
      <PageHeader
        titulo="Subastas"
        descripcion="Todo lo que sale a subasta, empresa por empresa. Se guarda como registro histórico; lo que te interese pásalo a Posibles ofertas."
        acciones={<button className="btn btn-primario" onClick={() => setImportando(true)}>Importar desde Prosubastas</button>}
      />
      {error && <div style={{ marginBottom: 16 }}><Alerta>{error}</Alerta></div>}
      {aviso && <div style={{ marginBottom: 16 }}><Alerta tipo="ok">{aviso}</Alerta></div>}

      <BuscadorHistorico valor={historico} onCambio={setHistorico} subastas={subastas} onAbrir={(id) => { setHistorico(''); setSubastaId(id) }} />

      {subastas.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="texto-suave" style={{ marginTop: 0 }}>Todavía no hay subastas. Pega el enlace de Prosubastas para traer los listados.</p>
          <button className="btn btn-primario" onClick={() => setImportando(true)}>Importar desde Prosubastas</button>
        </div>
      ) : (
        <div className="chips">
          {subastas.map((s) => (
            <button key={s.id} className={`chip${subastaId === s.id ? ' activa' : ''}`} onClick={() => setSubastaId(s.id)}>
              {fecha(s.fecha)} · {s.patio_origen ?? s.plataforma}{conteos[s.id] ? ` · ${conteos[s.id]}` : ''}
            </button>
          ))}
        </div>
      )}

      {subasta && (
        <>
          <div className="card">
            <div className="seccion-header" style={{ marginBottom: 12 }}>
              <div>
                <div className="card-titulo">{subasta.plataforma} · {fecha(subasta.fecha)} · {subasta.patio_origen ?? 'Sin patio'}</div>
                <p className="card-sub" style={{ margin: 0 }}>
                  {unidades.length} unidades de {listados.length} empresas
                  {subasta.url_origen && <> · <a href={subasta.url_origen} target="_blank" rel="noreferrer">listados en Prosubastas ↗</a></>}
                </p>
              </div>
              <button className="btn-link peligro" onClick={eliminarSubasta}>Eliminar subasta</button>
            </div>
            <div className="form-grid" style={{ alignItems: 'end' }}>
              <Campo label="Fotos del patio (enlace de Dropbox)">
                <input className="input" value={enlaceFotos} placeholder="https://www.dropbox.com/scl/fo/…" onChange={(e) => setEnlaceFotos(e.target.value)} />
              </Campo>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 2 }}>
                {enlaceFotos.trim() !== (subasta.enlace_fotos ?? '') && <button className="btn btn-secundario" onClick={guardarEnlaceFotos}>Guardar enlace</button>}
                {subasta.enlace_fotos && enlaceFotos.trim() === subasta.enlace_fotos && (
                  dropboxConectado()
                    ? <button className="btn btn-primario" disabled={Boolean(vinculando)} onClick={vincularFotos}>{vinculando ?? `Ligar fotos (${conFotos}/${unidades.length})`}</button>
                    : <><span className="texto-suave">Para ligar y ver las fotos, conecta Dropbox en este navegador:</span> <ConectarDropbox /></>
                )}
              </div>
            </div>
          </div>

          <div className="kpis">
            <Kpi label="Unidades" valor={String(unidades.length)} nota={`${listados.length} empresas`} />
            <Kpi label="Con fotos" valor={String(conFotos)} />
            <Kpi label="En Posibles ofertas" valor={String(evaluaciones.length)} />
          </div>

          <div className="chips">
            <button className={`chip${empresa === 'todas' ? ' activa' : ''}`} onClick={() => setEmpresa('todas')}>Todas · {unidades.length}</button>
            {listados.map((l) => (
              <button key={l.id} className={`chip${empresa === l.id ? ' activa' : ''}`} onClick={() => setEmpresa(l.id)} title={l.vendedor ?? ''}>
                {l.codigo} · {l.unidades}
              </button>
            ))}
          </div>
          {empresa !== 'todas' && (() => {
            const l = listados.find((x) => x.id === empresa)
            return l && (
              <p className="texto-suave" style={{ marginTop: -6 }}>
                {l.vendedor ?? l.codigo}
                {l.url && <> · <a href={l.url} target="_blank" rel="noreferrer">PDF original ↗</a></>}
                {l.carpeta_fotos && <> · fotos en {l.carpeta_fotos}</>}
              </p>
            )
          })()}

          <div className="filtros">
            <input className="input" placeholder="Filtrar por marca, modelo, año, torre, stock o serie…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
            {visibles.length !== unidades.length && <span className="texto-suave filtros-cuenta">{visibles.length} de {unidades.length}</span>}
          </div>

          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr><th>Torre</th><th>Unidad</th><th>Km</th><th className="num">Factura</th><th></th></tr>
              </thead>
              <tbody>
                {visibles.map((u) => {
                  const ev = evaluacionDe(u)
                  return (
                    <tr key={u.id}>
                      <td className="nowrap">{u.torre}<span className="unidad-folio">Stock {u.stock ?? '—'}</span></td>
                      <td>
                        <span className="unidad-nombre">{u.marca} {u.modelo} {u.anio ?? ''}</span>
                        <span className="unidad-folio">
                          {[u.version, u.color, u.transmision && TRANSMISION_LABEL[u.transmision], u.vin].filter(Boolean).join(' · ')}
                        </span>
                      </td>
                      <td className="nowrap">{km(u.kilometraje)}</td>
                      <td className="num">{mxn(u.valor_factura)}{u.fecha_factura && <span className="unidad-folio">{fecha(u.fecha_factura)}</span>}</td>
                      <td className="acciones-celda">
                        {subasta.enlace_fotos && (
                          <><button className="btn btn-secundario btn-chico" onClick={() => setViendoFotos(u)}>
                            Fotos{u.fotos_total ? ` (${u.fotos_total})` : ''}
                          </button>{' '}</>
                        )}
                        {ev
                          ? ev.vehiculo_id
                            ? <button className="btn-link" onClick={() => navigate(`/vehiculo/${ev.vehiculo_id}`)}>Comprada · ver unidad</button>
                            : <button className="btn-link" onClick={() => navigate('/posibles-ofertas')}><Badge tono="ok">En Posibles ofertas</Badge></button>
                          : <button className="btn btn-primario btn-chico" onClick={() => meInteresa(u)}>Me interesa</button>}
                      </td>
                    </tr>
                  )
                })}
                {visibles.length === 0 && (
                  <tr><td colSpan={5} className="vacio">{unidades.length ? 'Ninguna unidad coincide.' : 'Esta subasta no tiene listados importados.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {importando && (
        <ImportarModal
          onClose={() => setImportando(false)}
          onTerminado={(id) => { setImportando(false); cargarSubastas(id).then(() => { if (id) cargarDetalle(id) }) }}
        />
      )}
      {viendoFotos && subasta?.enlace_fotos && (
        <FotosDropboxModal
          enlace={subasta.enlace_fotos}
          torre={viendoFotos.torre}
          stock={viendoFotos.stock}
          titulo={`${viendoFotos.marca} ${viendoFotos.modelo} ${viendoFotos.anio ?? ''}`}
          onClose={() => setViendoFotos(null)}
        />
      )}
    </div>
  )
}

/* ── Importar ─────────────────────────────────────────────────────── */

function ImportarModal({ onClose, onTerminado }: { onClose: () => void; onTerminado: (subastaId: number | null) => void }) {
  const [enlace, setEnlace] = useState('')
  const [archivos, setArchivos] = useState<ArchivoListado[] | null>(null)
  const [elegidos, setElegidos] = useState<Set<string>>(new Set())
  const [buscando, setBuscando] = useState(false)
  const [progreso, setProgreso] = useState<string | null>(null)
  const [resultados, setResultados] = useState<(ResultadoImportacion | { error: string })[]>([])
  const [error, setError] = useState<string | null>(null)

  async function buscar() {
    setBuscando(true)
    setError(null)
    setArchivos(null)
    try {
      const a = await buscarListados(enlace)
      if (a.length === 0) setError('No se encontraron PDFs en esa carpeta.')
      setArchivos(a)
      setElegidos(new Set(a.map((x) => x.url)))
    } catch (e) {
      setError((e as Error).message)
    }
    setBuscando(false)
  }

  async function importar(lista: { blob: () => Promise<Blob>; origen: Partial<ArchivoListado> & { nombre: string } }[]) {
    const salida: (ResultadoImportacion | { error: string })[] = []
    for (const [i, item] of lista.entries()) {
      setProgreso(`Importando ${i + 1} de ${lista.length}: ${item.origen.nombre}`)
      try { salida.push(await importarListado(await item.blob(), item.origen)) } catch (e) { salida.push({ error: (e as Error).message }) }
      setResultados([...salida])
    }
    setProgreso(null)
  }

  const terminado = resultados.length > 0 && !progreso
  const primeraSubasta = resultados.find((r): r is ResultadoImportacion => 'subastaId' in r)?.subastaId ?? null
  const porPatio = (archivos ?? []).reduce<Record<string, ArchivoListado[]>>((acc, a) => { (acc[a.patio || 'Archivo'] ??= []).push(a); return acc }, {})

  return (
    <Modal titulo="Importar listados de Prosubastas" subtitulo="Pega el enlace de cualquier PDF del patio (trae todas sus empresas), de la carpeta del patio o de la fecha (todos los patios)." ancho={820} onClose={onClose}>
      {terminado ? (
        <div className="form">
          <div className="tabla-wrap">
            <table className="tabla">
              <thead><tr><th>Listado</th><th>Patio</th><th className="num">Unidades</th></tr></thead>
              <tbody>
                {resultados.map((r, i) => 'error' in r
                  ? <tr key={i}><td colSpan={3}><span className="texto-peligro">{r.error}</span></td></tr>
                  : <tr key={i}><td>{r.codigo}<span className="unidad-folio">{r.vendedor}</span></td><td>{r.patio} · {fecha(r.fecha)}</td><td className="num">{r.unidades}</td></tr>)}
              </tbody>
            </table>
          </div>
          <div className="form-acciones"><button className="btn btn-primario" onClick={() => onTerminado(primeraSubasta)}>Ver catálogo</button></div>
        </div>
      ) : (
        <div className="form">
          <Campo label="Enlace de Prosubastas" ayuda="Ej. https://prosubastas.com.mx/subastas/2026_10_09/  (toda la fecha)  o  …/2026_10_09/GDL/  (un patio)">
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="https://prosubastas.com.mx/subastas/…" />
              <button className="btn btn-secundario" disabled={!enlace.trim() || buscando || Boolean(progreso)} onClick={buscar}>{buscando ? 'Buscando…' : 'Buscar'}</button>
            </div>
          </Campo>
          <Campo label="…o sube los PDF desde tu computadora">
            <input className="input" type="file" accept="application/pdf" multiple disabled={Boolean(progreso)}
              onChange={(e) => {
                const fs = [...(e.target.files ?? [])]
                if (fs.length) importar(fs.map((f) => ({ blob: async () => f, origen: { nombre: f.name, orden: f.name.match(/^(\d{1,3})/)?.[1]?.padStart(2, '0') } })))
              }} />
          </Campo>
          {error && <Alerta>{error}</Alerta>}
          {archivos && archivos.length > 0 && (
            <>
              {Object.entries(porPatio).map(([patio, lista]) => (
                <div key={patio}>
                  <div className="card-titulo" style={{ fontSize: 15 }}>{patio} · {lista.length} empresas · {lista[0].version}</div>
                  {lista.map((a) => (
                    <label key={a.url} className="check" style={{ display: 'flex', margin: '4px 0' }}>
                      <input type="checkbox" checked={elegidos.has(a.url)} disabled={Boolean(progreso)}
                        onChange={() => setElegidos((s) => { const n = new Set(s); if (n.has(a.url)) n.delete(a.url); else n.add(a.url); return n })} />
                      {a.nombre}
                    </label>
                  ))}
                </div>
              ))}
              <div className="form-acciones" style={{ alignItems: 'center' }}>
                {progreso && <span className="texto-suave">{progreso}</span>}
                <button className="btn btn-primario" disabled={elegidos.size === 0 || Boolean(progreso)}
                  onClick={() => importar(archivos.filter((a) => elegidos.has(a.url)).map((a) => ({ blob: () => descargarListado(a.url), origen: a })))}>
                  Importar {elegidos.size} listados
                </button>
              </div>
            </>
          )}
          {!archivos && progreso && <p className="texto-suave">{progreso}</p>}
        </div>
      )}
    </Modal>
  )
}

/* ── Histórico ────────────────────────────────────────────────────── */

type ResultadoHistorico = SubastaUnidad & { subasta: { id: number; fecha: string; patio_origen: string | null } | null }

/** Busca en TODAS las subastas guardadas: ¿esta serie / este modelo ya salió antes? */
function BuscadorHistorico({ valor, onCambio, subastas, onAbrir }: {
  valor: string; onCambio: (v: string) => void; subastas: Subasta[]; onAbrir: (subastaId: number) => void
}) {
  const [resultados, setResultados] = useState<ResultadoHistorico[] | null>(null)
  const q = valor.trim()

  useEffect(() => {
    if (!supabase || q.length < 3) { setResultados(null); return }
    const t = setTimeout(async () => {
      const like = `%${q.replace(/[%_,()]/g, ' ')}%`
      const { data } = await supabase!.from('subasta_unidad')
        .select('*, subasta:subasta_id(id, fecha, patio_origen)')
        .or(`vin.ilike.${like},stock.ilike.${like},marca.ilike.${like},modelo.ilike.${like},version.ilike.${like}`)
        .order('id', { ascending: false }).limit(100)
      setResultados((data ?? []) as unknown as ResultadoHistorico[])
    }, 350)
    return () => clearTimeout(t)
  }, [q])

  if (subastas.length === 0) return null
  return (
    <div className="card">
      <div className="card-titulo">Histórico de subastas</div>
      <p className="card-sub">Busca en todas las subastas guardadas por serie, stock, marca, modelo o versión.</p>
      <input className="input" placeholder="Ej. Territory, 1FM5K8GC…, 21023" value={valor} onChange={(e) => onCambio(e.target.value)} />
      {resultados && (
        <div className="tabla-wrap" style={{ marginTop: 12 }}>
          <table className="tabla">
            <thead><tr><th>Subasta</th><th>Unidad</th><th>Km</th><th className="num">Factura</th><th></th></tr></thead>
            <tbody>
              {resultados.map((r) => (
                <tr key={r.id}>
                  <td className="nowrap">{r.subasta ? `${fecha(r.subasta.fecha)} · ${r.subasta.patio_origen ?? ''}` : '—'}<span className="unidad-folio">{r.torre} · stock {r.stock ?? '—'}</span></td>
                  <td><span className="unidad-nombre">{r.marca} {r.modelo} {r.anio ?? ''}</span><span className="unidad-folio">{[r.version, r.color, r.vin].filter(Boolean).join(' · ')}</span></td>
                  <td className="nowrap">{km(r.kilometraje)}</td>
                  <td className="num">{mxn(r.valor_factura)}</td>
                  <td className="acciones-celda">{r.subasta && <button className="btn-link" onClick={() => onAbrir(r.subasta!.id)}>Ver subasta</button>}</td>
                </tr>
              ))}
              {resultados.length === 0 && <tr><td colSpan={5} className="vacio">Nada encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
