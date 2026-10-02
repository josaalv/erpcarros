import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCatalogos } from '../lib/catalogos'
import { mxn, diasDesde, etiqueta, ESTADO_COMERCIAL } from '../lib/helpers'
import { PageHeader, Kpi, Alerta, Cargando, EtiquetaBadge, Seccion } from '../components/Ui'
import type { VehiculoFicha } from '../types'

export default function Panel() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const { estados } = useCatalogos()
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        {veCifras && <Kpi label="Capital invertido" valor={mxn(capital)} nota="Compra + gastos de las unidades activas" />}
        {veCifras && <Kpi label="Utilidad proyectada" valor={mxn(utilidad)} nota="Contra el precio autorizado" />}
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
                  <td className="num">{diasDesde(v.fecha_compra) ?? '—'}</td>
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
