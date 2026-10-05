import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { mxn, porcentaje, fecha, CANAL_LABEL, legible } from '../lib/helpers'
import { PageHeader, Kpi, Cargando, Alerta, NombreUnidad } from '../components/Ui'
import type { CierreFinanciero } from '../types'

type Cierre = CierreFinanciero & { vehiculo: { id: number; id_interno: string; marca: string; modelo: string; anio: number } | null }
interface Estimado { vehiculo_id: number; costo_reparacion_estimado: number | null; precio_venta_esperado: number | null }
interface Costo { vehiculo_id: number; total_gastos: number }

const PERIODOS = [
  { dias: 30, label: 'Últimos 30 días' },
  { dias: 90, label: 'Últimos 3 meses' },
  { dias: 180, label: 'Últimos 6 meses' },
  { dias: 365, label: 'Último año' },
  { dias: 0, label: 'Todo' },
]

interface Fila {
  cierre: Cierre
  gastos: number
  repEstimada: number | null
  desvioRep: number | null
  ventaEsperada: number | null
}

const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

function signo(v: number | null) {
  if (v === null) return '—'
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${mxn(Math.abs(v))}`
}

/**
 * Resultados de las unidades ya cerradas (solo admin por RLS de
 * cierre_financiero). El desvío de reparación compara lo gastado contra lo
 * estimado en Posibles ofertas: si una marca siempre se pasa, hay que pujar
 * menos por ella.
 */
export default function Resultados() {
  const [cierres, setCierres] = useState<Cierre[]>([])
  const [estimados, setEstimados] = useState<Estimado[]>([])
  const [costos, setCostos] = useState<Costo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState(90)

  useEffect(() => {
    if (!supabase) return
    Promise.all([
      supabase.from('cierre_financiero').select('*, vehiculo:vehiculo_id(id, id_interno, marca, modelo, anio)').order('fecha_cierre', { ascending: false }),
      supabase.from('evaluacion_puja').select('vehiculo_id, costo_reparacion_estimado, precio_venta_esperado').not('vehiculo_id', 'is', null),
      supabase.from('v_costo_vehiculo').select('vehiculo_id, total_gastos'),
    ]).then(([c, e, v]) => {
      if (c.error) setError(c.error.message)
      setCierres((c.data ?? []) as unknown as Cierre[])
      setEstimados((e.data ?? []) as Estimado[])
      setCostos((v.data ?? []) as Costo[])
      setCargando(false)
    })
  }, [])

  const filas: Fila[] = useMemo(() => {
    const desde = periodo ? Date.now() - periodo * 86400000 : 0
    return cierres
      .filter((c) => new Date(c.fecha_cierre).getTime() >= desde)
      .map((c) => {
        const est = estimados.find((e) => e.vehiculo_id === c.vehiculo_id)
        const gastos = costos.find((x) => x.vehiculo_id === c.vehiculo_id)?.total_gastos ?? 0
        const repEstimada = est?.costo_reparacion_estimado ?? null
        return {
          cierre: c,
          gastos,
          repEstimada,
          desvioRep: repEstimada !== null ? gastos - repEstimada : null,
          ventaEsperada: est?.precio_venta_esperado ?? null,
        }
      })
  }, [cierres, estimados, costos, periodo])

  const porMarca = useMemo(() => {
    const grupos = new Map<string, Fila[]>()
    for (const f of filas) {
      const marca = f.cierre.vehiculo?.marca ?? 'Sin marca'
      grupos.set(marca, [...(grupos.get(marca) ?? []), f])
    }
    return [...grupos.entries()]
      .map(([marca, fs]) => ({
        marca,
        unidades: fs.length,
        utilidad: fs.reduce((a, f) => a + f.cierre.utilidad_bruta, 0),
        margen: promedio(fs.map((f) => f.cierre.margen)),
        dias: promedio(fs.map((f) => f.cierre.dias_inventario)),
        desvio: promedio(fs.map((f) => f.desvioRep).filter((x): x is number => x !== null)),
      }))
      .sort((a, b) => b.utilidad - a.utilidad)
  }, [filas])

  if (cargando) return <Cargando />

  const utilidad = filas.reduce((a, f) => a + f.cierre.utilidad_bruta, 0)
  const vendido = filas.reduce((a, f) => a + f.cierre.precio_final, 0)
  const desvios = filas.map((f) => f.desvioRep).filter((x): x is number => x !== null)

  return (
    <div>
      <PageHeader
        titulo="Resultados"
        descripcion="Cómo les fue a las unidades ya cerradas: utilidad, días en inventario y qué tan acertado fue el presupuesto de reparación."
        acciones={
          <select className="select" value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))}>
            {PERIODOS.map((p) => <option key={p.dias} value={p.dias}>{p.label}</option>)}
          </select>
        }
      />
      {error && <Alerta>{error}</Alerta>}

      <div className="kpis">
        <Kpi label="Unidades cerradas" valor={String(filas.length)} />
        <Kpi label="Vendido" valor={mxn(vendido)} />
        <Kpi label="Utilidad" valor={mxn(utilidad)} nota={vendido > 0 ? `margen ${porcentaje(utilidad / vendido)}` : undefined} />
        <Kpi label="Días promedio" valor={filas.length ? String(Math.round(promedio(filas.map((f) => f.cierre.dias_inventario))!)) : '—'} nota="de compra a venta" />
        <Kpi
          label="Desvío de reparación"
          valor={desvios.length ? signo(promedio(desvios)) : '—'}
          nota={desvios.length ? `promedio por unidad (${desvios.length} con estimado)` : 'sin estimados de Posibles ofertas'}
        />
      </div>

      <div className="card">
        <div className="card-titulo">Por marca</div>
        <p className="card-sub">Desvío positivo = se gastó más de lo estimado en reparación.</p>
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr><th>Marca</th><th className="num">Unidades</th><th className="num">Utilidad</th><th className="num">Margen prom.</th><th className="num">Días prom.</th><th className="num">Desvío reparación</th></tr>
            </thead>
            <tbody>
              {porMarca.map((m) => (
                <tr key={m.marca}>
                  <td>{m.marca}</td>
                  <td className="num">{m.unidades}</td>
                  <td className="num">{mxn(m.utilidad)}</td>
                  <td className="num">{porcentaje(m.margen)}</td>
                  <td className="num">{m.dias === null ? '—' : Math.round(m.dias)}</td>
                  <td className={`num ${m.desvio === null ? '' : m.desvio > 0 ? 'texto-peligro' : 'texto-ok'}`}>{signo(m.desvio)}</td>
                </tr>
              ))}
              {porMarca.length === 0 && <tr><td colSpan={6} className="vacio">No hay cierres en este periodo.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-titulo">Unidad por unidad</div>
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Unidad</th><th>Cierre</th><th className="num">Costo</th><th className="num">Venta</th>
                <th className="num">Utilidad</th><th className="num">Días</th><th className="num">Reparación<br />est. → real</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ cierre: c, gastos, repEstimada, desvioRep }) => (
                <tr key={c.id}>
                  <td>{c.vehiculo ? <NombreUnidad v={c.vehiculo} /> : '—'}</td>
                  <td>
                    <span className="nowrap">{fecha(c.fecha_cierre.slice(0, 10))}</span>
                    <span className="unidad-folio">{CANAL_LABEL[c.canal_venta] ?? legible(c.canal_venta)}</span>
                  </td>
                  <td className="num">{mxn(c.costo_total)}</td>
                  <td className="num">{mxn(c.precio_final)}</td>
                  <td className={`num ${c.utilidad_bruta < 0 ? 'texto-peligro' : ''}`}>
                    {mxn(c.utilidad_bruta)}
                    <span className="unidad-folio">{porcentaje(c.margen)}</span>
                  </td>
                  <td className="num">{c.dias_inventario}</td>
                  <td className="num nowrap">
                    {mxn(repEstimada)} → <span className={desvioRep === null ? '' : desvioRep > 0 ? 'texto-peligro' : 'texto-ok'}>{mxn(gastos)}</span>
                  </td>
                </tr>
              ))}
              {filas.length === 0 && <tr><td colSpan={7} className="vacio">No hay cierres en este periodo.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
