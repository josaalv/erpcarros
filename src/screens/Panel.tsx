import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCatalogos } from '../lib/catalogos'
import { mxn, diasDesde, etiqueta, ESTADO_COMERCIAL } from '../lib/helpers'
import { PageHeader, Kpi, Alerta, Cargando, EtiquetaBadge, Seccion, DiasBadge } from '../components/Ui'
import { useParametros } from '../lib/parametros'
import type { VehiculoFicha } from '../types'

export default function Panel() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const { estados } = useCatalogos()
  const { dias_alerta, dias_critico } = useParametros()
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [porCobrar, setPorCobrar] = useState<number | null>(null)
  const [porPagar, setPorPagar] = useState<number | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('v_vehiculo_ficha')
      .select('*')
      .neq('estado_comercial', 'vendido')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        setVehiculos((data ?? []) as VehiculoFicha[])
        setCargando(false)
      })
    // Saldos de ventas (admin/gerencia) y gastos sin pagar (solo admin: RLS de gasto).
    supabase.from('v_saldo_venta').select('saldo').gt('saldo', 0)
      .then(({ data }) => setPorCobrar(((data ?? []) as { saldo: number }[]).reduce((a, x) => a + x.saldo, 0)))
    supabase.from('gasto').select('importe').eq('pagado', false)
      .then(({ data }) => setPorPagar(((data ?? []) as { importe: number }[]).reduce((a, x) => a + x.importe, 0)))
  }, [])

  if (cargando) return <Cargando />

  const veCifras = perfil?.rol === 'admin'
  const capital = vehiculos.reduce((acc, v) => acc + (v.costo_total ?? 0), 0)
  const utilidad = vehiculos.reduce((acc, v) => acc + (v.utilidad ?? 0), 0)
  const umbralListo = estados.find((e) => e.clave === 'listo')?.orden ?? 70
  const ordenDe = (v: VehiculoFicha) => estados.find((e) => e.id === v.estado_proceso_id)?.orden ?? 0
  const enPreparacion = vehiculos.filter((v) => ordenDe(v) < umbralListo).length
  const enVenta = vehiculos.length - enPreparacion
  const nombreEstado = (id: number) => estados.find((e) => e.id === id)?.nombre ?? '—'

  const criticas = vehiculos.filter((v) => (diasDesde(v.fecha_compra) ?? 0) >= dias_critico).length
  const enAlerta = vehiculos.filter((v) => { const d = diasDesde(v.fecha_compra) ?? 0; return d >= dias_alerta && d < dias_critico }).length
  const ordenados = [...vehiculos].sort((a, b) => (diasDesde(b.fecha_compra) ?? -1) - (diasDesde(a.fecha_compra) ?? -1))

  return (
    <div>
      <PageHeader
        titulo="Panel"
        descripcion={`Resumen de las unidades activas${perfil?.rol === 'demo' ? ' (datos de demostración)' : ''}.`}
      />

      {error && <Alerta>No se pudo consultar la información: {error}</Alerta>}

      <div className="kpis">
        <Kpi label="Unidades activas" valor={String(vehiculos.length)} />
        <Kpi label="En preparación" valor={String(enPreparacion)} nota="Compradas, en traslado o en taller" />
        <Kpi label="Listas para vender" valor={String(enVenta)} />
        <Kpi label="Atrasadas" valor={String(criticas + enAlerta)} nota={`${criticas} en rojo (${dias_critico}+ días) · ${enAlerta} en amarillo (${dias_alerta}+)`} />
        {veCifras && <Kpi label="Capital invertido" valor={mxn(capital)} nota="Compra + gastos de las unidades activas" />}
        {veCifras && <Kpi label="Utilidad proyectada" valor={mxn(utilidad)} nota="Contra el precio autorizado" />}
        {porCobrar !== null && perfil?.rol !== 'comisionista' && <Kpi label="Por cobrar" valor={mxn(porCobrar)} nota="Ventas con dinero pendiente" />}
        {veCifras && porPagar !== null && <Kpi label="Por pagar" valor={mxn(porPagar)} nota="Gastos registrados sin pagar" />}
      </div>

      <Seccion titulo="Unidades activas" descripcion="Las que llevan más días en inventario aparecen primero.">
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Unidad</th>
                <th>Etapa</th>
                <th>Estado comercial</th>
                <th className="num">Días</th>
                <th className="num">Precio autorizado</th>
                {veCifras && <th className="num">Costo</th>}
                {veCifras && <th className="num">Utilidad</th>}
              </tr>
            </thead>
            <tbody>
              {ordenados.map((v) => (
                <tr key={v.id} className="clic" onClick={() => navigate(`/vehiculo/${v.id}`)}>
                  <td>
                    <span className="unidad-nombre">{v.marca} {v.modelo} {v.anio}</span>
                    <span className="unidad-folio">{v.id_interno}</span>
                  </td>
                  <td className="texto-suave">{nombreEstado(v.estado_proceso_id)}</td>
                  <td><EtiquetaBadge etiqueta={etiqueta(ESTADO_COMERCIAL, v.estado_comercial)} /></td>
                  <td className="num"><DiasBadge dias={diasDesde(v.fecha_compra)} /></td>
                  <td className="num">{mxn(v.precio_autorizado)}</td>
                  {veCifras && <td className="num">{mxn(v.costo_total)}</td>}
                  {veCifras && <td className="num">{mxn(v.utilidad)}</td>}
                </tr>
              ))}
              {vehiculos.length === 0 && (
                <tr><td colSpan={7} className="vacio">Todavía no hay unidades activas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Seccion>
    </div>
  )
}
