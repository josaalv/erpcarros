import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCatalogos } from '../lib/catalogos'
import { useBorrador } from '../lib/useBorrador'
import { useParametros } from '../lib/parametros'
import { mxn, km, fecha, legible, ESQUEMA_COMISION_LABEL } from '../lib/helpers'
import { Modal, FormBotones, PageHeader, Campo, Alerta, Cargando, Badge } from '../components/Ui'
import type { Comisionista as TComisionista, Prospecto, Comision, Cliente, VehiculoFicha } from '../types'

type ProspectoConCliente = Prospecto & { cliente?: Cliente | null }
type Pestana = 'catalogo' | 'referidos' | 'comisiones'

/** Portal de comisionista; RLS limita todo a sus propias filas (mi_comisionista_id()). */
export default function Comisionista() {
  const { session } = useAuth()
  const { estados, cargando: cargandoCatalogos } = useCatalogos()
  const [pestana, setPestana] = useState<Pestana>('catalogo')
  const [yo, setYo] = useState<TComisionista | null>(null)
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [prospectos, setProspectos] = useState<ProspectoConCliente[]>([])
  const [comisiones, setComisiones] = useState<Comision[]>([])
  const [cargando, setCargando] = useState(true)
  const [abrirReferido, setAbrirReferido] = useState(false)

  const userId = session?.user.id
  async function recargar() {
    if (!supabase || !userId) return
    const [yoRes, v, p, c] = await Promise.all([
      supabase.from('comisionista').select('*').eq('perfil_id', userId).maybeSingle(),
      supabase.from('v_vehiculo_ficha').select('*').neq('estado_comercial', 'vendido').order('id_interno'),
      supabase.from('prospecto').select('*, cliente:cliente_id(*)').order('fecha_registro', { ascending: false }),
      supabase.from('comision').select('*'),
    ])
    setYo(yoRes.data as TComisionista | null)
    setVehiculos((v.data ?? []) as VehiculoFicha[])
    setProspectos((p.data ?? []) as unknown as ProspectoConCliente[])
    setComisiones((c.data ?? []) as Comision[])
    setCargando(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { recargar() }, [userId])

  if (cargando || cargandoCatalogos) return <Cargando />

  // Solo unidades ya listas para venta: mientras siguen en reparación no se ofrecen.
  const umbralListo = estados.find((e) => e.clave === 'listo')?.orden ?? 70
  const publicadas = vehiculos.filter((v) => {
    const estado = estados.find((e) => e.id === v.estado_proceso_id)
    return estado && !estado.es_final && estado.orden >= umbralListo
  })

  return (
    <div>
      <PageHeader
        titulo={yo ? `Hola, ${yo.nombre.split(' ')[0]}` : 'Portal de comisionista'}
        descripcion="Unidades disponibles para ofrecer, tus clientes referidos y tus comisiones."
        acciones={yo && <button className="btn btn-primario" onClick={() => setAbrirReferido(true)}>+ Nuevo referido</button>}
      />

      {!yo && (
        <div style={{ marginBottom: 16 }}>
          <Alerta tipo="aviso">Tu usuario todavía no está ligado a un registro de comisionista. Pídele al administrador que lo vincule para poder registrar referidos.</Alerta>
        </div>
      )}

      <div className="tabs">
        <button className={`tab${pestana === 'catalogo' ? ' activa' : ''}`} onClick={() => setPestana('catalogo')}>Catálogo ({publicadas.length})</button>
        <button className={`tab${pestana === 'referidos' ? ' activa' : ''}`} onClick={() => setPestana('referidos')}>Mis referidos ({prospectos.length})</button>
        <button className={`tab${pestana === 'comisiones' ? ' activa' : ''}`} onClick={() => setPestana('comisiones')}>Mis comisiones</button>
      </div>

      {pestana === 'catalogo' && (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead><tr><th>Unidad</th><th>Kilometraje</th><th>Descripción</th><th>Indicaciones</th><th className="num">Precio</th><th className="num">Tu comisión</th></tr></thead>
            <tbody>
              {publicadas.map((v) => (
                <tr key={v.id}>
                  <td><span className="unidad-nombre">{v.marca} {v.modelo} {v.anio}</span><span className="unidad-folio">{v.id_interno}</span></td>
                  <td>{km(v.kilometraje_final ?? v.kilometraje)}</td>
                  <td>{v.descripcion_breve ?? <span className="texto-muted">—</span>}</td>
                  <td>{v.indicaciones_comisionista ?? <span className="texto-muted">—</span>}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{mxn(v.precio_autorizado)}</td>
                  <td className="num" style={{ color: 'var(--primary)', fontWeight: 600 }}>{mxn(v.comision_ofrecida)}</td>
                </tr>
              ))}
              {publicadas.length === 0 && <tr><td colSpan={6} className="vacio">No hay unidades disponibles por ahora.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {pestana === 'referidos' && (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead><tr><th>Cliente</th><th>Unidad de interés</th><th>Etapa</th><th>Registrado</th></tr></thead>
            <tbody>
              {prospectos.map((p) => {
                const veh = vehiculos.find((v) => v.id === p.vehiculo_id)
                return (
                  <tr key={p.id}>
                    <td><span style={{ fontWeight: 600 }}>{p.cliente?.nombre ?? '—'}</span>{p.cliente?.telefono && <span className="unidad-folio">{p.cliente.telefono}</span>}</td>
                    <td>{veh ? `${veh.marca} ${veh.modelo} ${veh.anio}` : <span className="texto-muted">—</span>}</td>
                    <td><Badge tono="info">{legible(p.etapa)}</Badge></td>
                    <td>{fecha(p.fecha_registro)}</td>
                  </tr>
                )
              })}
              {prospectos.length === 0 && <tr><td colSpan={4} className="vacio">Todavía no has registrado referidos.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {pestana === 'comisiones' && (
        yo && !yo.ver_comisiones ? (
          <Alerta tipo="info">Tu cuenta no tiene habilitada la consulta de comisiones. Pídele al administrador que la active.</Alerta>
        ) : (
          <div className="tabla-wrap">
            <table className="tabla">
              <thead><tr><th>Esquema</th><th className="num">Estimado</th><th className="num">Autorizado</th><th className="num">Pagado</th><th>Estado</th></tr></thead>
              <tbody>
                {comisiones.map((c) => (
                  <tr key={c.id}>
                    <td>{ESQUEMA_COMISION_LABEL[c.esquema] ?? legible(c.esquema)}</td>
                    <td className="num">{mxn(c.monto_estimado)}</td>
                    <td className="num">{mxn(c.monto_autorizado)}</td>
                    <td className="num">{mxn(c.monto_pagado)}</td>
                    <td>{c.fecha_pago ? <Badge tono="ok">Pagada {fecha(c.fecha_pago)}</Badge> : <Badge tono="aviso">Pendiente</Badge>}</td>
                  </tr>
                ))}
                {comisiones.length === 0 && <tr><td colSpan={5} className="vacio">Todavía no tienes comisiones.</td></tr>}
              </tbody>
            </table>
          </div>
        )
      )}

      {abrirReferido && yo && (
        <ReferidoModal
          comisionistaId={yo.id}
          vehiculos={publicadas}
          onClose={() => setAbrirReferido(false)}
          onGuardado={() => { setAbrirReferido(false); setPestana('referidos'); recargar() }}
        />
      )}
    </div>
  )
}

function ReferidoModal({ comisionistaId, vehiculos, onClose, onGuardado }: {
  comisionistaId: number
  vehiculos: VehiculoFicha[]
  onClose: () => void
  onGuardado: () => void
}) {
  const { dias_atribucion_referido: dias } = useParametros()
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:referido:${comisionistaId}`, { nombre: '', telefono: '', vehiculoId: '' })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)

    const { data: cliente, error: errCliente } = await supabase
      .from('cliente')
      .insert({ nombre: form.nombre.trim(), telefono: form.telefono.trim() || null, origen: 'referido' })
      .select()
      .single()

    if (errCliente || !cliente) {
      setGuardando(false)
      setError(errCliente?.message ?? 'No se pudo registrar al cliente.')
      return
    }

    const { error: errProspecto } = await supabase.from('prospecto').insert({
      cliente_id: cliente.id,
      vehiculo_id: form.vehiculoId ? Number(form.vehiculoId) : null,
      comisionista_id: comisionistaId,
      etapa: 'nuevo',
      vence_atribucion: new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10),
    })

    setGuardando(false)
    if (errProspecto) { setError(errProspecto.message); return }
    limpiarBorrador()
    onGuardado()
  }

  return (
    <Modal titulo="Nuevo referido" subtitulo={`Tu referido queda a tu nombre durante ${dias} días.`} onClose={onClose}>
      <form onSubmit={onSubmit} className="form">
        <Campo label="Nombre del cliente"><input className="input" required value={form.nombre} onChange={(e) => set('nombre', e.target.value)} autoFocus /></Campo>
        <Campo label="Teléfono"><input className="input" type="tel" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} /></Campo>
        <Campo label="Unidad de interés (opcional)">
          <select className="select" value={form.vehiculoId} onChange={(e) => set('vehiculoId', e.target.value)}>
            <option value="">Ninguna en particular</option>
            {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.marca} {v.modelo} {v.anio} · {v.id_interno}</option>)}
          </select>
        </Campo>
        {error && <Alerta>{error}</Alerta>}
        <FormBotones onClose={onClose} guardando={guardando} textoGuardar="Registrar referido" />
      </form>
    </Modal>
  )
}
