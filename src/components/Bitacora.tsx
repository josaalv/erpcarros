import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCatalogos } from '../lib/catalogos'
import {
  mxn, porcentaje, fecha, legible, km,
  ESTADO_COMERCIAL, ESTADO_DOCUMENTAL, ESTADO_VENTA, CANAL_LABEL, FORMA_PAGO_LABEL, TRANSMISION_LABEL, ESQUEMA_COMISION_LABEL, ORIGEN_COBRO_LABEL,
} from '../lib/helpers'
import { Cargando, Badge } from './Ui'

interface FilaBitacora {
  id: number
  tabla: string
  registro_id: number | null
  vehiculo_id: number | null
  accion: 'alta' | 'cambio' | 'baja'
  cambios: Record<string, unknown>
  usuario_nombre: string | null
  ocurrido: string
}

const TABLA_LABEL: Record<string, string> = {
  vehiculo: 'Unidad',
  compra: 'Compra',
  gasto: 'Gasto',
  aportacion: 'Capital de socio',
  venta: 'Venta',
  comision: 'Comisión',
  cierre_financiero: 'Cierre financiero',
  liquidacion: 'Liquidación a socio',
  socio: 'Socio',
  cobro: 'Cobro',
}

const ACCION: Record<string, { label: string; tono: 'ok' | 'info' | 'peligro' }> = {
  alta: { label: 'Alta', tono: 'ok' },
  cambio: { label: 'Cambio', tono: 'info' },
  baja: { label: 'Baja', tono: 'peligro' },
}

const CAMPO_LABEL: Record<string, string> = {
  id_interno: 'Folio', marca: 'Marca', modelo: 'Modelo', version: 'Versión', color: 'Color', transmision: 'Transmisión', notas: 'Notas', torre: 'Torre', vin: 'Serie (VIN)', anio: 'Año', numero_motor: 'Número de motor', kilometraje: 'Km de llegada',
  kilometraje_final: 'Km final', stock_subasta: 'Stock', subasta_id: 'Subasta', estado_proceso_id: 'Etapa',
  ubicacion_id: 'Ubicación', estado_comercial: 'Estado comercial', estado_documental: 'Documentación',
  fecha_compra: 'Fecha de compra', precio_autorizado: 'Precio autorizado', precio_minimo: 'Precio mínimo',
  precio_lote: 'Precio en lote', canal_venta: 'Canal', descripcion_breve: 'Descripción', indicaciones_comisionista: 'Indicaciones',
  comision_ofrecida: 'Comisión ofrecida', impuestos: 'Impuestos', iva: 'IVA', comision: 'Comisión', precio: 'Precio',
  categoria_id: 'Categoría', descripcion: 'Descripción', importe: 'Importe', pagador_tipo: 'Pagó', pagador_socio_id: 'Socio que pagó',
  proveedor_id: 'Proveedor', comprobante_path: 'Comprobante', socio_id: 'Socio', monto: 'Monto', precio_acordado: 'Precio de venta',
  forma_pago: 'Forma de pago', fecha_venta: 'Fecha de venta', fecha_entrega: 'Fecha de entrega', cliente_id: 'Cliente',
  comisionista_id: 'Comisionista', esquema: 'Esquema', monto_estimado: 'Monto estimado', monto_autorizado: 'Monto autorizado',
  monto_pagado: 'Monto pagado', fecha_pago: 'Fecha de pago', costo_total: 'Costo total', precio_final: 'Precio final',
  utilidad_bruta: 'Utilidad', margen: 'Margen', roi: 'ROI', dias_inventario: 'Días en inventario', cerrado_por: 'Cerrado por',
  capital_aportado: 'Capital', participacion: 'Participación', utilidad_asignada: 'Utilidad asignada', monto_a_pagar: 'A pagar',
  pagado: 'Pagado', fecha_vencimiento: 'Fecha límite', origen: 'De', referencia: 'Referencia',
  fecha_liquidacion_esperada: 'Se espera el resto', activo: 'Activo', observaciones: 'Observaciones', valor_toma: 'Valor de toma', veh_tomado_id: 'Unidad tomada',
}

const DINERO = new Set([
  'precio', 'comision', 'impuestos', 'iva', 'importe', 'monto', 'precio_acordado', 'precio_autorizado', 'precio_minimo',
  'precio_lote', 'costo_total', 'precio_final', 'utilidad_bruta', 'capital_aportado', 'utilidad_asignada', 'monto_a_pagar',
  'monto_estimado', 'monto_autorizado', 'monto_pagado', 'comision_ofrecida', 'valor_toma',
])
const PORCENTAJE = new Set(['margen', 'roi', 'participacion'])
// Campos técnicos que no le dicen nada a quien revisa.
const OCULTOS = new Set(['id', 'es_demo', 'updated_at', 'created_at', 'vehiculo_id', 'venta_id', 'cierre_id', 'cerrado_por', 'fecha_cierre'])

type Nombres = Record<string, Record<number, string>>

function valor(campo: string, v: unknown, nombres: Nombres): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (DINERO.has(campo)) return mxn(Number(v))
  if (PORCENTAJE.has(campo)) return porcentaje(Number(v))
  if (campo === 'kilometraje' || campo === 'kilometraje_final') return km(Number(v))
  if (campo.startsWith('fecha') && typeof v === 'string') return fecha(v.slice(0, 10))
  if (campo === 'comprobante_path') return 'archivo adjunto'
  const s = String(v)
  if (campo === 'estado_comercial') return ESTADO_COMERCIAL[s]?.label ?? legible(s)
  if (campo === 'estado_documental') return ESTADO_DOCUMENTAL[s]?.label ?? legible(s)
  if (campo === 'estado') return ESTADO_VENTA[s]?.label ?? legible(s)
  if (campo === 'canal' || campo === 'canal_venta') return CANAL_LABEL[s] ?? legible(s)
  if (campo === 'forma_pago') return FORMA_PAGO_LABEL[s] ?? legible(s)
  if (campo === 'transmision') return TRANSMISION_LABEL[s] ?? legible(s)
  if (campo === 'esquema') return ESQUEMA_COMISION_LABEL[s] ?? legible(s)
  if (campo === 'origen') return ORIGEN_COBRO_LABEL[s] ?? legible(s)
  const catalogo = nombres[campo]
  if (catalogo && typeof v === 'number') return catalogo[v] ?? `#${v}`
  return s
}

function Detalle({ fila, nombres }: { fila: FilaBitacora; nombres: Nombres }) {
  const campos = Object.entries(fila.cambios).filter(([k]) => !OCULTOS.has(k))
  if (fila.accion === 'cambio') {
    return (
      <ul className="bitacora-cambios">
        {campos.map(([k, par]) => {
          const [antes, despues] = Array.isArray(par) ? par : [null, par]
          return (
            <li key={k}>
              <span className="texto-suave">{CAMPO_LABEL[k] ?? legible(k)}:</span>{' '}
              <s>{valor(k, antes, nombres)}</s> → <strong>{valor(k, despues, nombres)}</strong>
            </li>
          )
        })}
      </ul>
    )
  }
  const visibles = campos.filter(([, v]) => v !== null && v !== '' && v !== false)
  return (
    <span className="texto-suave">
      {visibles.slice(0, 8).map(([k, v]) => `${CAMPO_LABEL[k] ?? legible(k)}: ${valor(k, v, nombres)}`).join(' · ')}
      {visibles.length > 8 && ' …'}
    </span>
  )
}

function cuando(ts: string) {
  const d = new Date(ts)
  return d.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/**
 * Historial de cambios (tabla `bitacora`, solo admin por RLS). Con vehiculoId
 * muestra el de una unidad; sin él, lo más reciente de todo el sistema con
 * filtros.
 */
export function Bitacora({ vehiculoId }: { vehiculoId?: number }) {
  const { estados, ubicaciones, categorias } = useCatalogos()
  const [filas, setFilas] = useState<FilaBitacora[]>([])
  const [socios, setSocios] = useState<Record<number, string>>({})
  const [proveedores, setProveedores] = useState<Record<number, string>>({})
  const [unidades, setUnidades] = useState<Record<number, string>>({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tabla, setTabla] = useState('')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    if (!supabase) return
    let q = supabase.from('bitacora').select('*').order('ocurrido', { ascending: false }).limit(vehiculoId ? 500 : 300)
    if (vehiculoId) q = q.eq('vehiculo_id', vehiculoId)
    if (tabla) q = q.eq('tabla', tabla)
    Promise.all([
      q,
      supabase.from('socio').select('id, nombre'),
      supabase.from('proveedor').select('id, nombre'),
    ]).then(async ([b, s, p]) => {
      if (b.error) { setError(b.error.message); setCargando(false); return }
      const datos = (b.data ?? []) as FilaBitacora[]
      setFilas(datos)
      setSocios(Object.fromEntries(((s.data ?? []) as { id: number; nombre: string }[]).map((x) => [x.id, x.nombre])))
      setProveedores(Object.fromEntries(((p.data ?? []) as { id: number; nombre: string }[]).map((x) => [x.id, x.nombre])))
      if (!vehiculoId) {
        const ids = [...new Set(datos.map((f) => f.vehiculo_id).filter((x): x is number => x !== null))]
        if (ids.length > 0) {
          const { data: vs } = await supabase!.from('vehiculo').select('id, id_interno, marca, modelo').in('id', ids)
          setUnidades(Object.fromEntries(((vs ?? []) as { id: number; id_interno: string; marca: string; modelo: string }[])
            .map((v) => [v.id, `${v.id_interno} · ${v.marca} ${v.modelo}`])))
        }
      }
      setCargando(false)
    })
  }, [vehiculoId, tabla])

  const nombres: Nombres = useMemo(() => ({
    estado_proceso_id: Object.fromEntries(estados.map((e) => [e.id, e.nombre])),
    ubicacion_id: Object.fromEntries(ubicaciones.map((u) => [u.id, u.nombre])),
    categoria_id: Object.fromEntries(categorias.map((c) => [c.id, c.nombre])),
    socio_id: socios,
    pagador_socio_id: socios,
    proveedor_id: proveedores,
  }), [estados, ubicaciones, categorias, socios, proveedores])

  const t = busqueda.trim().toLowerCase()
  const visibles = t
    ? filas.filter((f) => (f.usuario_nombre ?? '').toLowerCase().includes(t)
      || (f.vehiculo_id !== null && (unidades[f.vehiculo_id] ?? '').toLowerCase().includes(t)))
    : filas

  if (cargando) return <Cargando />
  if (error) return <p className="texto-suave">No se pudo leer el historial: {error}</p>

  return (
    <div className="card">
      <div className="card-titulo">Historial de cambios</div>
      <p className="card-sub">
        Quién dio de alta, cambió o borró qué, y cuándo. Lo registra la base de datos automáticamente; nadie lo puede editar.
      </p>
      <div className="filtros">
        <select className="select" value={tabla} onChange={(e) => { setCargando(true); setTabla(e.target.value) }}>
          <option value="">Todo</option>
          {Object.entries(TABLA_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {!vehiculoId && (
          <input className="input" placeholder="Buscar por usuario o unidad…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        )}
      </div>
      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr><th>Fecha</th><th>Usuario</th>{!vehiculoId && <th>Unidad</th>}<th>Qué</th><th>Detalle</th></tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.id}>
                <td className="nowrap">{cuando(f.ocurrido)}</td>
                <td className="nowrap">{f.usuario_nombre ?? 'Sistema'}</td>
                {!vehiculoId && (
                  <td>
                    {f.vehiculo_id === null ? '—'
                      : unidades[f.vehiculo_id] ? <Link to={`/vehiculo/${f.vehiculo_id}?tab=historial`}>{unidades[f.vehiculo_id]}</Link>
                      : <span className="texto-suave">Unidad borrada</span>}
                  </td>
                )}
                <td className="nowrap">
                  <Badge tono={ACCION[f.accion].tono}>{ACCION[f.accion].label}</Badge>{' '}
                  {TABLA_LABEL[f.tabla] ?? legible(f.tabla)}
                </td>
                <td><Detalle fila={f} nombres={nombres} /></td>
              </tr>
            ))}
            {visibles.length === 0 && <tr><td colSpan={vehiculoId ? 4 : 5} className="vacio">Sin cambios registrados.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
