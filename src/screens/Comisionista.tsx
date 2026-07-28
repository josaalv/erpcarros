import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCatalogos } from '../lib/catalogos'
import { useBorrador } from '../lib/useBorrador'
import { mxn } from '../lib/helpers'
import { inputStyle, th, td, btnPrimario } from '../lib/ui'
import { Modal, FormBotones } from '../components/Ui'
import type { Comisionista as TComisionista, Prospecto, Comision, Cliente, VehiculoFicha } from '../types'

type ProspectoConCliente = Prospecto & { cliente?: Cliente | null }

/**
 * Portal de comisionista: Catálogo, Mis referidos, Mis comisiones. Todo
 * acotado por RLS a las filas del propio comisionista (mi_comisionista_id()).
 */
export default function Comisionista() {
  const { session } = useAuth()
  const { estados, cargando: cargandoCatalogos } = useCatalogos()
  const [tab, setTab] = useState<'catalogo' | 'referidos' | 'comisiones'>('referidos')
  const [yo, setYo] = useState<TComisionista | null>(null)
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [prospectos, setProspectos] = useState<ProspectoConCliente[]>([])
  const [comisiones, setComisiones] = useState<Comision[]>([])
  const [cargando, setCargando] = useState(true)
  const [abrirReferido, setAbrirReferido] = useState(false)

  async function recargar() {
    if (!supabase || !session) return
    const [yoRes, v, p, c] = await Promise.all([
      supabase.from('comisionista').select('*').eq('perfil_id', session.user.id).maybeSingle(),
      supabase.from('v_vehiculo_ficha').select('*').order('id_interno'),
      supabase.from('prospecto').select('*, cliente:cliente_id(*)').order('fecha_registro', { ascending: false }),
      supabase.from('comision').select('*'),
    ])
    setYo(yoRes.data as TComisionista | null)
    setVehiculos((v.data ?? []) as VehiculoFicha[])
    setProspectos((p.data ?? []) as unknown as ProspectoConCliente[])
    setComisiones((c.data ?? []) as Comision[])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [session])

  if (cargando || cargandoCatalogos) return <p>Cargando…</p>

  // Catálogo: solo unidades que ya llegaron a la etapa de publicación (listo
  // para venta) y no se han vendido — la información de comisionistas no
  // tiene sentido mientras la unidad sigue en reparación.
  const umbralListo = estados.find((e) => e.clave === 'listo')?.orden ?? 70
  const publicadas = vehiculos.filter((v) => {
    if (v.estado_comercial === 'vendido') return false
    const estado = estados.find((e) => e.id === v.estado_proceso_id)
    return estado && !estado.es_final && estado.orden >= umbralListo
  })

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ font: '400 26px Georgia, serif', margin: '0 0 4px' }}>Portal de comisionista</h1>
      <p style={{ color: '#8b8578', fontSize: 12.5, marginTop: 0, marginBottom: 20 }}>{yo?.nombre ?? ''}</p>

      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid #e4e0d8' }}>
        {(['referidos', 'catalogo', 'comisiones'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '9px 14px', fontSize: 12.5, border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: tab === t ? '2px solid #26302f' : '2px solid transparent',
              fontWeight: tab === t ? 500 : 400, color: tab === t ? '#1c1b19' : '#8b8578',
            }}
          >
            {t === 'referidos' ? 'Mis referidos' : t === 'catalogo' ? 'Catálogo' : 'Mis comisiones'}
          </button>
        ))}
      </div>

      {tab === 'catalogo' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff' }}>
          <thead>
            <tr style={{ background: '#faf9f6' }}>{['Unidad', 'Km', 'Descripción', 'Indicaciones', 'Precio', 'Comisión'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {publicadas.map((v) => (
              <tr key={v.id} style={{ borderTop: '1px solid #f0ede6' }}>
                <td style={td}><Link to={`/vehiculo/${v.id}`} style={{ color: '#1c1b19' }}>{v.marca} {v.modelo} {v.anio} · {v.id_interno}</Link></td>
                <td style={td}>{(v.kilometraje_final ?? v.kilometraje)?.toLocaleString('es-MX') ?? '—'} km</td>
                <td style={td}>{v.descripcion_breve ?? '—'}</td>
                <td style={td}>{v.indicaciones_comisionista ?? '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>{mxn(v.precio_autorizado)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{mxn(v.comision_ofrecida)}</td>
              </tr>
            ))}
            {publicadas.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#8b8578' }}>Sin unidades publicadas todavía.</td></tr>}
          </tbody>
        </table>
      )}

      {tab === 'referidos' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button onClick={() => setAbrirReferido(true)} style={btnPrimario}>+ Nuevo referido</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff' }}>
            <thead>
              <tr style={{ background: '#faf9f6' }}>{['Cliente', 'Unidad de interés', 'Etapa', 'Registrado'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {prospectos.map((p) => {
                const veh = vehiculos.find((v) => v.id === p.vehiculo_id)
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid #f0ede6' }}>
                    <td style={td}>{p.cliente?.nombre ?? '—'} <span style={{ color: '#8b8578' }}>{p.cliente?.telefono ? `· ${p.cliente.telefono}` : ''}</span></td>
                    <td style={td}>{veh ? `${veh.marca} ${veh.modelo} · ${veh.id_interno}` : '—'}</td>
                    <td style={td}>{p.etapa}</td>
                    <td style={td}>{p.fecha_registro}</td>
                  </tr>
                )
              })}
              {prospectos.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#8b8578' }}>Sin referidos registrados todavía.</td></tr>}
            </tbody>
          </table>
        </>
      )}

      {tab === 'comisiones' && (
        yo && !yo.ver_comisiones ? (
          <p style={{ fontSize: 12, color: '#8b8578' }}>Tu cuenta no tiene habilitada la visibilidad de comisiones. Pídele a un administrador que la active.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff' }}>
            <thead>
              <tr style={{ background: '#faf9f6' }}>{['Esquema', 'Estimado', 'Autorizado', 'Pagado', 'Fecha de pago'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {comisiones.map((c) => (
                <tr key={c.id} style={{ borderTop: '1px solid #f0ede6' }}>
                  <td style={td}>{c.esquema}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{mxn(c.monto_estimado)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{mxn(c.monto_autorizado)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{mxn(c.monto_pagado)}</td>
                  <td style={td}>{c.fecha_pago ?? '—'}</td>
                </tr>
              ))}
              {comisiones.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#8b8578' }}>Sin comisiones registradas todavía.</td></tr>}
            </tbody>
          </table>
        )
      )}

      {abrirReferido && yo && (
        <ReferidoModal
          comisionistaId={yo.id}
          vehiculos={publicadas}
          onClose={() => setAbrirReferido(false)}
          onGuardado={() => { setAbrirReferido(false); recargar() }}
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
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:referido:${comisionistaId}`, {
    nombre: '', telefono: '', vehiculoId: '',
  })
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
      .insert({ nombre: form.nombre, telefono: form.telefono || null, origen: 'referido' })
      .select()
      .single()

    if (errCliente || !cliente) {
      setGuardando(false)
      setError(errCliente?.message ?? 'No se pudo crear el cliente.')
      return
    }

    const { error: errProspecto } = await supabase.from('prospecto').insert({
      cliente_id: cliente.id,
      vehiculo_id: form.vehiculoId ? Number(form.vehiculoId) : null,
      comisionista_id: comisionistaId,
      etapa: 'nuevo',
      vence_atribucion: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    })

    setGuardando(false)
    if (errProspecto) { setError(errProspecto.message); return }
    limpiarBorrador()
    onGuardado()
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0, font: '500 16px Georgia, serif' }}>Nuevo referido</h3>
        <input required placeholder="Nombre del cliente" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} style={inputStyle} />
        <input placeholder="Teléfono" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} style={inputStyle} />
        <select value={form.vehiculoId} onChange={(e) => set('vehiculoId', e.target.value)} style={inputStyle}>
          <option value="">Unidad de interés (opcional)…</option>
          {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.id_interno} · {v.marca} {v.modelo} {v.anio}</option>)}
        </select>
        {error && <div style={{ fontSize: 11.5, color: 'oklch(0.48 0.13 32)' }}>{error}</div>}
        <FormBotones onClose={onClose} guardando={guardando} />
      </form>
    </Modal>
  )
}
