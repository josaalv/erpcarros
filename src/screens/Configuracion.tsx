import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useParametros, recargarParametros, type Parametros } from '../lib/parametros'
import { fecha, ROL_LABEL } from '../lib/helpers'
import { PageHeader, Campo, Alerta, Modal, Cargando } from '../components/Ui'
import { TablaEditable } from '../components/TablaEditable'
import Usuarios from './Usuarios'
import { conectarDropbox, desconectarDropbox, dropboxConectado } from '../lib/dropbox'
import { Bitacora } from '../components/Bitacora'

type Pestana = 'general' | 'catalogos' | 'personas' | 'usuarios' | 'historial' | 'datos'

const PESTANAS: { clave: Pestana; label: string }[] = [
  { clave: 'general', label: 'General' },
  { clave: 'catalogos', label: 'Catálogos' },
  { clave: 'personas', label: 'Personas y empresas' },
  { clave: 'usuarios', label: 'Usuarios' },
  { clave: 'historial', label: 'Historial de cambios' },
  { clave: 'datos', label: 'Datos y respaldos' },
]

// Claves que el código usa directamente (alta en comprado/traslado, umbral
// "listo" de En venta, vendido como estado final): se pueden renombrar,
// pero borrarlas rompería esas pantallas.
const ESTADOS_DEL_SISTEMA = ['comprado', 'listo', 'vendido']
const UBICACIONES_DEL_SISTEMA = ['traslado']

export default function Configuracion() {
  const [params, setParams] = useSearchParams()
  const pedida = params.get('tab') as Pestana | null
  const pestana: Pestana = PESTANAS.some((p) => p.clave === pedida) ? pedida! : 'general'

  return (
    <div>
      <PageHeader titulo="Configuración" descripcion="Ajustes del sistema, catálogos, personas con las que trabajas, usuarios y respaldos." />
      <div className="tabs">
        {PESTANAS.map((p) => (
          <button key={p.clave} className={`tab${pestana === p.clave ? ' activa' : ''}`}
            onClick={() => setParams(p.clave === 'general' ? {} : { tab: p.clave }, { replace: true })}>
            {p.label}
          </button>
        ))}
      </div>

      {pestana === 'general' && <><General /><ConexionDropbox /></>}
      {pestana === 'catalogos' && <Catalogos />}
      {pestana === 'personas' && <Personas />}
      {pestana === 'usuarios' && <Usuarios />}
      {pestana === 'historial' && <Bitacora />}
      {pestana === 'datos' && <DatosYRespaldos />}
    </div>
  )
}

/* ── General ───────────────────────────────────────────────────────── */

function General() {
  const actuales = useParametros()
  const aForm = (p: Parametros) =>
    Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])) as Record<keyof Parametros, string>
  const [form, setForm] = useState(() => aForm(actuales))
  const [cargado, setCargado] = useState(actuales)
  if (cargado !== actuales) {
    setCargado(actuales)
    setForm(aForm(actuales))
  }
  const set = (k: keyof Parametros, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    setOk(false)
    const filas = (Object.keys(form) as (keyof Parametros)[]).map((clave) => ({ clave, valor: form[clave].trim(), actualizado: new Date().toISOString() }))
    const { error } = await supabase.from('parametro').upsert(filas)
    setGuardando(false)
    if (error) { setError(error.message); return }
    await recargarParametros()
    setOk(true)
  }

  return (
    <form className="card" onSubmit={guardar} style={{ maxWidth: 760 }}>
      <div className="card-titulo">Parámetros del negocio</div>
      <p className="card-sub">Valores que el sistema usa por defecto. Cambiarlos no modifica registros ya guardados.</p>
      <div className="form">
        <Campo label="Nombre de la empresa" ayuda="Aparece en el menú y en la pantalla de entrada">
          <input className="input" required value={form.empresa_nombre} onChange={(e) => set('empresa_nombre', e.target.value)} />
        </Campo>
        <div className="form-grid">
          <Campo label="Comisión de subasta" ayuda="Se usa en el cálculo de puja y como valor inicial de la compra">
            <input className="input" required type="number" min={0} step="0.01" value={form.comision_subasta} onChange={(e) => set('comision_subasta', e.target.value)} />
          </Campo>
          <Campo label="Margen deseado (%)" ayuda="Valor inicial al evaluar un vehículo en Posibles ofertas">
            <input className="input" required type="number" min={0} max={100} step="0.1" value={form.margen_deseado} onChange={(e) => set('margen_deseado', e.target.value)} />
          </Campo>
          <Campo label="Días que dura un referido" ayuda="Tiempo que un cliente queda a nombre del comisionista">
            <input className="input" required type="number" min={1} step="1" value={form.dias_atribucion_referido} onChange={(e) => set('dias_atribucion_referido', e.target.value)} />
          </Campo>
          <Campo label="Días en inventario: alerta" ayuda="A partir de aquí la unidad se marca en amarillo">
            <input className="input" required type="number" min={1} step="1" value={form.dias_alerta} onChange={(e) => set('dias_alerta', e.target.value)} />
          </Campo>
          <Campo label="Días en inventario: crítico" ayuda="A partir de aquí se marca en rojo">
            <input className="input" required type="number" min={1} step="1" value={form.dias_critico} onChange={(e) => set('dias_critico', e.target.value)} />
          </Campo>
        </div>
        {error && <Alerta>{error}</Alerta>}
        <div className="form-acciones" style={{ alignItems: 'center' }}>
          {ok && <span className="ok-inline">Guardado ✓</span>}
          <button type="submit" className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar parámetros'}</button>
        </div>
      </div>
    </form>
  )
}

/* ── Dropbox ───────────────────────────────────────────────────────── */

/**
 * Conexión de ESTE navegador con Dropbox para traer fotos, hoja de
 * inspección y REPUVE de las subastas. La App key es pública (OAuth PKCE,
 * sin secreto) y se guarda como parámetro; el permiso queda en el navegador.
 */
function ConexionDropbox() {
  const { dropbox_app_key } = useParametros()
  const [clave, setClave] = useState(dropbox_app_key)
  const [cargada, setCargada] = useState(dropbox_app_key)
  if (cargada !== dropbox_app_key) { setCargada(dropbox_app_key); setClave(dropbox_app_key) }
  const [conectado, setConectado] = useState(dropboxConectado())
  const [error, setError] = useState<string | null>(() => {
    const e = sessionStorage.getItem('dropbox:error')
    sessionStorage.removeItem('dropbox:error')
    return e
  })
  const [guardando, setGuardando] = useState(false)

  async function conectar() {
    if (!supabase) return
    const k = clave.trim()
    if (!k) { setError('Escribe la App key de tu app de Dropbox.'); return }
    setGuardando(true)
    setError(null)
    if (k !== dropbox_app_key) {
      const { error: err } = await supabase.from('parametro').upsert({ clave: 'dropbox_app_key', valor: k, actualizado: new Date().toISOString() })
      if (err) { setGuardando(false); setError(err.message); return }
      await recargarParametros()
    }
    await conectarDropbox(k)  // sale a Dropbox y regresa aquí
  }

  return (
    <div className="card" style={{ maxWidth: 760 }}>
      <div className="card-titulo">Dropbox (fotos de las subastas)</div>
      <p className="card-sub">
        Permite ver en Posibles ofertas las fotos, la hoja de inspección y el REPUVE de cada unidad directo desde la carpeta
        compartida de la subasta, y copiarlas a la unidad al adquirirla. La conexión es por navegador.
      </p>
      <div className="form">
        <Campo label="App key de Dropbox" ayuda="De tu app en dropbox.com/developers/apps (no es secreta).">
          <input className="input" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="p. ej. a1b2c3d4e5f6g7h" />
        </Campo>
        {error && <Alerta>{error}</Alerta>}
        <div className="form-acciones" style={{ alignItems: 'center' }}>
          {conectado && <span className="ok-inline">Conectado en este navegador ✓</span>}
          {conectado && <button type="button" className="btn btn-secundario" onClick={() => { desconectarDropbox(); setConectado(false) }}>Desconectar</button>}
          <button type="button" className="btn btn-primario" onClick={conectar} disabled={guardando}>
            {guardando ? 'Abriendo Dropbox…' : conectado ? 'Volver a conectar' : 'Conectar Dropbox'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Catálogos ─────────────────────────────────────────────────────── */

function Catalogos() {
  return (
    <>
      <p className="texto-suave" style={{ marginTop: 0 }}>
        Las listas de opciones que aparecen en todo el sistema. Si una opción ya se usó, en vez de eliminarla desactívala:
        deja de ofrecerse pero los registros anteriores la conservan.
      </p>
      <TablaEditable
        tabla="estado_proceso" titulo="Etapas del proceso" orden="orden" generarClave protegidas={ESTADOS_DEL_SISTEMA}
        descripcion='El orden define el avance. Desde "Listo para venta" en adelante la unidad aparece en En venta.'
        campos={[
          { clave: 'nombre', label: 'Nombre', requerido: true },
          { clave: 'orden', label: 'Orden', tipo: 'numero', requerido: true, ayuda: 'Número más alto = etapa más avanzada' },
          { clave: 'es_final', label: 'Etapa final', tipo: 'si_no', valorInicial: false, ayuda: 'La unidad ya no está en operación' },
          { clave: 'activo', label: 'Activa', tipo: 'si_no' },
        ]}
      />
      <TablaEditable
        tabla="ubicacion" titulo="Ubicaciones" generarClave protegidas={UBICACIONES_DEL_SISTEMA}
        descripcion="Dónde puede estar físicamente una unidad."
        campos={[
          { clave: 'nombre', label: 'Nombre', requerido: true },
          { clave: 'es_externa', label: 'Fuera de nuestras instalaciones', tipo: 'si_no', valorInicial: false },
          { clave: 'activo', label: 'Activa', tipo: 'si_no' },
        ]}
      />
      <TablaEditable
        tabla="categoria_gasto" titulo="Categorías de gasto" orden="orden" generarClave
        descripcion="Para clasificar los gastos de cada unidad."
        campos={[
          { clave: 'nombre', label: 'Nombre', requerido: true },
          { clave: 'grupo', label: 'Grupo', requerido: true, ayuda: 'Ej. taller, refacciones, logística' },
          { clave: 'orden', label: 'Orden', tipo: 'numero', valorInicial: '100' },
          { clave: 'activo', label: 'Activa', tipo: 'si_no' },
        ]}
      />
      <TablaEditable
        tabla="tipo_documento" titulo="Documentos de la unidad" orden="orden" generarClave
        descripcion="El checklist de papeles que aparece en el expediente de cada unidad."
        campos={[
          { clave: 'nombre', label: 'Nombre', requerido: true },
          { clave: 'orden', label: 'Orden', tipo: 'numero', valorInicial: '100' },
          { clave: 'obligatorio', label: 'Obligatorio', tipo: 'si_no', valorInicial: false },
          { clave: 'activo', label: 'Activo', tipo: 'si_no' },
        ]}
      />
    </>
  )
}

/* ── Personas y empresas ───────────────────────────────────────────── */

function Personas() {
  const [perfiles, setPerfiles] = useState<{ id: string; nombre: string; rol: string }[] | null>(null)

  useEffect(() => {
    supabase?.from('perfil').select('id, nombre, rol').order('nombre').then(({ data }) => setPerfiles((data ?? []) as { id: string; nombre: string; rol: string }[]))
  }, [])

  if (!perfiles) return <Cargando />

  return (
    <>
      <TablaEditable
        tabla="comisionista" titulo="Comisionistas" textoNuevo="Agregar comisionista"
        descripcion='Para que un comisionista entre a su portal, liga su usuario (con rol Comisionista) aquí.'
        campos={[
          { clave: 'nombre', label: 'Nombre', requerido: true },
          { clave: 'telefono', label: 'Teléfono' },
          { clave: 'correo', label: 'Correo', tipo: 'correo' },
          {
            clave: 'perfil_id', label: 'Usuario del sistema', tipo: 'opciones',
            opciones: perfiles.map((p) => ({ valor: p.id, label: `${p.nombre} (${ROL_LABEL[p.rol] ?? p.rol})` })),
          },
          { clave: 'ver_comisiones', label: 'Puede ver sus comisiones', tipo: 'si_no', valorInicial: false },
          { clave: 'activo', label: 'Activo', tipo: 'si_no' },
        ]}
      />
      <TablaEditable
        tabla="cliente" titulo="Clientes" textoNuevo="Agregar cliente"
        campos={[
          { clave: 'nombre', label: 'Nombre', requerido: true },
          { clave: 'telefono', label: 'Teléfono' },
          { clave: 'correo', label: 'Correo', tipo: 'correo' },
          {
            clave: 'origen', label: 'Cómo llegó', tipo: 'opciones', requerido: true, valorInicial: 'directo',
            opciones: [
              { valor: 'directo', label: 'Directo' }, { valor: 'referido', label: 'Referido' },
              { valor: 'lote', label: 'Lote' }, { valor: 'anuncio', label: 'Anuncio' }, { valor: 'otro', label: 'Otro' },
            ],
          },
          { clave: 'notas', label: 'Notas', tipo: 'textarea', enTabla: false },
        ]}
      />
      <TablaEditable
        tabla="lote" titulo="Lotes de consignación" textoNuevo="Agregar lote"
        descripcion="Lotes externos donde se dejan unidades a consignación."
        campos={[
          { clave: 'nombre', label: 'Nombre', requerido: true },
          { clave: 'contacto', label: 'Contacto' },
          { clave: 'telefono', label: 'Teléfono' },
          { clave: 'activo', label: 'Activo', tipo: 'si_no' },
        ]}
      />
      <TablaEditable
        tabla="proveedor" titulo="Proveedores y talleres" textoNuevo="Agregar proveedor"
        descripcion="Talleres externos, refaccionarias y gestores."
        campos={[
          { clave: 'nombre', label: 'Nombre', requerido: true },
          { clave: 'empresa', label: 'Empresa' },
          { clave: 'especialidad', label: 'Especialidad' },
          { clave: 'telefono', label: 'Teléfono' },
          { clave: 'correo', label: 'Correo', tipo: 'correo', enTabla: false },
          { clave: 'es_gestor', label: 'Es gestor de trámites', tipo: 'si_no', valorInicial: false, enTabla: false },
          { clave: 'activo', label: 'Activo', tipo: 'si_no' },
        ]}
      />
    </>
  )
}

/* ── Datos y respaldos ─────────────────────────────────────────────── */

interface Respaldo { id: number; creado: string; sufijo: string; conteos: Record<string, number>; usuario_nombre: string | null }

const FRASE = 'BORRAR UNIDADES'

function DatosYRespaldos() {
  const [respaldos, setRespaldos] = useState<Respaldo[] | null>(null)
  const [errorLista, setErrorLista] = useState<string | null>(null)
  const [unidades, setUnidades] = useState<number | null>(null)
  const [abrir, setAbrir] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  async function recargar() {
    if (!supabase) return
    const [r, v] = await Promise.all([
      supabase.rpc('listar_respaldos'),
      supabase.from('vehiculo').select('id', { count: 'exact', head: true }),
    ])
    if (r.error) setErrorLista(r.error.message)
    setRespaldos((r.data ?? []) as Respaldo[])
    setUnidades(v.count ?? 0)
  }

  useEffect(() => { recargar() }, [])

  return (
    <>
      {resultado && <div style={{ marginBottom: 16 }}><Alerta tipo="ok">{resultado}</Alerta></div>}

      <div className="card" style={{ borderColor: '#f6cdb8' }}>
        <div className="card-titulo" style={{ color: 'var(--danger)' }}>Borrar toda la información de unidades</div>
        <p className="card-sub">
          Para empezar a cargar los datos oficiales desde cero. Antes de borrar se guarda un respaldo completo dentro de la base.
        </p>
        <div className="datos" style={{ marginBottom: 16 }}>
          <div>
            <div className="dato-label">Se borra</div>
            <div style={{ marginTop: 4 }}>
              Unidades{unidades !== null ? ` (${unidades})` : ''}, con su compra, gastos, documentos, aportaciones de socios,
              ventas, comisiones, cierres y liquidaciones. También subastas y evaluaciones.
            </div>
          </div>
          <div>
            <div className="dato-label">Se conserva</div>
            <div style={{ marginTop: 4 }}>
              Socios, clientes, comisionistas, lotes, proveedores, catálogos, parámetros, usuarios y los datos de demostración.
            </div>
          </div>
        </div>
        <button className="btn btn-peligro" onClick={() => setAbrir(true)} disabled={!!errorLista}>Borrar información de unidades…</button>
      </div>

      <section className="seccion">
        <div className="seccion-header">
          <div>
            <h2>Respaldos</h2>
            <p>Copias guardadas antes de cada borrado. Si necesitas recuperar algo, pide que se restaure desde aquí.</p>
          </div>
        </div>
        {errorLista ? (
          <Alerta tipo="aviso">
            La función de respaldo todavía no está instalada en la base de datos ({errorLista}). Falta aplicar la migración
            015_configuracion_parametros_y_borrado_maestro.sql.
          </Alerta>
        ) : respaldos === null ? <Cargando /> : (
          <div className="tabla-wrap">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Hecho por</th><th className="num">Unidades</th><th className="num">Gastos</th><th>Identificador</th></tr></thead>
              <tbody>
                {respaldos.map((r) => (
                  <tr key={r.id}>
                    <td>{fecha(r.creado)} · {new Date(r.creado).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{r.usuario_nombre ?? '—'}</td>
                    <td className="num">{r.conteos.vehiculo ?? 0}</td>
                    <td className="num">{r.conteos.gasto ?? 0}</td>
                    <td className="texto-muted">{r.sufijo}</td>
                  </tr>
                ))}
                {respaldos.length === 0 && <tr><td colSpan={5} className="vacio">Todavía no se ha hecho ningún respaldo.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {abrir && (
        <BorrarModal
          unidades={unidades ?? 0}
          onClose={() => setAbrir(false)}
          onHecho={(msg) => { setAbrir(false); setResultado(msg); recargar() }}
        />
      )}
    </>
  )
}

function BorrarModal({ unidades, onClose, onHecho }: { unidades: number; onClose: () => void; onHecho: (msg: string) => void }) {
  const [confirmacion, setConfirmacion] = useState('')
  const [borrando, setBorrando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Primero el respaldo (función en la base); solo si sale bien se borra. El
  // borrado va por RLS como admin: la cascada de vehiculo se lleva compra,
  // gastos, documentos, ventas, cierres, etc. Los datos demo no se tocan.
  async function borrar() {
    if (!supabase || confirmacion !== FRASE) return
    setBorrando(true)
    setError(null)
    const { data, error } = await supabase.rpc('respaldar_unidades')
    if (error) { setBorrando(false); setError(`No se pudo hacer el respaldo, no se borró nada: ${error.message}`); return }
    const r = data as { sufijo: string; respaldado: Record<string, number> }

    for (const tabla of ['cobro', 'evaluacion_puja', 'vehiculo', 'subasta'] as const) {
      const { error: errBorrar } = await supabase.from(tabla).delete().eq('es_demo', false)
      if (errBorrar) {
        setBorrando(false)
        setError(`El respaldo ${r.sufijo} se guardó, pero falló el borrado de ${tabla}: ${errBorrar.message}. Puedes volver a intentarlo.`)
        return
      }
    }
    setBorrando(false)
    onHecho(`Listo. Se respaldaron y borraron ${r.respaldado.vehiculo ?? 0} unidades y ${r.respaldado.gasto ?? 0} gastos (respaldo ${r.sufijo}). Ya puedes cargar la información oficial.`)
  }

  return (
    <Modal
      titulo="Borrar información de unidades"
      subtitulo={`Se van a borrar ${unidades} unidades y todo lo relacionado. Queda un respaldo dentro de la base, pero desde la aplicación no se puede deshacer.`}
      onClose={onClose}
    >
      <div className="form">
        <Campo label={`Escribe ${FRASE} para confirmar`}>
          <input className="input" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoFocus autoComplete="off" />
        </Campo>
        {error && <Alerta>{error}</Alerta>}
        <div className="form-acciones">
          <button type="button" className="btn btn-secundario" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-peligro-solido" disabled={confirmacion !== FRASE || borrando} onClick={borrar}>
            {borrando ? 'Respaldando y borrando…' : 'Respaldar y borrar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
