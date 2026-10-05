import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { mxn, fecha, hoyISO } from '../lib/helpers'
import { PageHeader, Kpi, Cargando, Alerta, NombreUnidad, Badge } from '../components/Ui'
import type { Gasto } from '../types'

type GastoPendiente = Gasto & {
  vehiculo: { id: number; id_interno: string; marca: string; modelo: string; anio: number } | null
  proveedor: { nombre: string; telefono: string | null } | null
}

/**
 * Gastos ya registrados (cuentan en el costo de su unidad) que todavía no se
 * pagan: talleres, refacciones, trámites. Solo admin (RLS de gasto).
 */
export default function PorPagar() {
  const [gastos, setGastos] = useState<GastoPendiente[]>([])
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [proveedor, setProveedor] = useState('')

  async function recargar() {
    if (!supabase) return
    const { data, error: err } = await supabase.from('gasto')
      .select('*, vehiculo:vehiculo_id(id, id_interno, marca, modelo, anio), proveedor:proveedor_id(nombre, telefono)')
      .eq('pagado', false)
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
    if (err) setError(err.message)
    setGastos((data ?? []) as unknown as GastoPendiente[])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  async function marcarPagado(g: GastoPendiente) {
    if (!supabase || !window.confirm(`¿Marcar como pagado "${g.descripcion}" por ${mxn(g.importe)} con fecha de hoy?`)) return
    setOcupado(g.id)
    setError(null)
    setAviso(null)
    const { error: err } = await supabase.from('gasto').update({ pagado: true, fecha_pago: hoyISO(), fecha_vencimiento: null }).eq('id', g.id)
    setOcupado(null)
    if (err) { setError(err.message); return }
    setAviso(`Pagado: ${g.descripcion} (${mxn(g.importe)}).`)
    recargar()
  }

  if (cargando) return <Cargando />

  const hoy = hoyISO()
  const nombreProv = (g: GastoPendiente) => g.proveedor?.nombre ?? 'Sin proveedor'
  const visibles = proveedor ? gastos.filter((g) => nombreProv(g) === proveedor) : gastos
  const total = gastos.reduce((a, g) => a + g.importe, 0)
  const vencidos = gastos.filter((g) => g.fecha_vencimiento && g.fecha_vencimiento < hoy)
  const porProveedor = [...new Set(gastos.map(nombreProv))]
    .map((p) => ({ p, total: gastos.filter((g) => nombreProv(g) === p).reduce((a, g) => a + g.importe, 0) }))
    .sort((a, b) => b.total - a.total)

  return (
    <div>
      <PageHeader
        titulo="Por pagar"
        descripcion="Gastos de las unidades que ya se hicieron pero todavía no se pagan. Ya cuentan en el costo de cada unidad."
      />
      {error && <div style={{ marginBottom: 16 }}><Alerta>{error}</Alerta></div>}
      {aviso && <div style={{ marginBottom: 16 }}><Alerta tipo="ok">{aviso}</Alerta></div>}

      <div className="kpis">
        <Kpi label="Total por pagar" valor={mxn(total)} nota={`${gastos.length} gastos pendientes`} />
        <Kpi label="Vencido" valor={mxn(vencidos.reduce((a, g) => a + g.importe, 0))} nota={`${vencidos.length} pasaron su fecha límite`} />
        {porProveedor[0] && <Kpi label="A quién se le debe más" valor={mxn(porProveedor[0].total)} nota={porProveedor[0].p} />}
      </div>

      <div className="filtros">
        <select className="select" value={proveedor} onChange={(e) => setProveedor(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {porProveedor.map(({ p, total: t }) => <option key={p} value={p}>{p} · {mxn(t)}</option>)}
        </select>
      </div>

      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr><th>Unidad</th><th>Concepto</th><th>Proveedor</th><th>Vence</th><th className="num">Importe</th><th></th></tr>
          </thead>
          <tbody>
            {visibles.map((g) => (
              <tr key={g.id} className={ocupado === g.id ? 'ocupado' : ''}>
                <td>{g.vehiculo ? <NombreUnidad v={g.vehiculo} /> : '—'}</td>
                <td>
                  {g.descripcion}
                  <span className="unidad-folio">Registrado {fecha(g.fecha)}</span>
                </td>
                <td>
                  {nombreProv(g)}
                  {g.proveedor?.telefono && <span className="unidad-folio">{g.proveedor.telefono}</span>}
                </td>
                <td>
                  {g.fecha_vencimiento
                    ? <Badge tono={g.fecha_vencimiento < hoy ? 'peligro' : g.fecha_vencimiento === hoy ? 'aviso' : 'neutral'}>{fecha(g.fecha_vencimiento)}</Badge>
                    : <span className="texto-suave">Sin fecha</span>}
                </td>
                <td className="num">{mxn(g.importe)}</td>
                <td className="acciones-celda">
                  <button className="btn btn-secundario btn-chico" disabled={ocupado !== null} onClick={() => marcarPagado(g)}>Marcar pagado</button>
                </td>
              </tr>
            ))}
            {visibles.length === 0 && <tr><td colSpan={6} className="vacio">No hay gastos pendientes de pago.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
