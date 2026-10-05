import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCatalogos } from '../lib/catalogos'
import { mxn, km, diasDesde, etiqueta, ESTADO_COMERCIAL, ESTADO_DOCUMENTAL } from '../lib/helpers'
import { useParametros } from '../lib/parametros'
import { PageHeader, Cargando, EtiquetaBadge, DiasBadge } from '../components/Ui'
import type { VehiculoFicha } from '../types'

/** Solo unidades activas; las vendidas viven en Vendidos. */
export default function Inventario() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const { estados } = useCatalogos()
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const { dias_alerta } = useParametros()
  const [busqueda, setBusqueda] = useState('')
  const [etapa, setEtapa] = useState('')
  const [soloAtrasadas, setSoloAtrasadas] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('v_vehiculo_ficha')
      .select('*')
      .neq('estado_comercial', 'vendido')
      .order('id_interno')
      .then(({ data }) => {
        setVehiculos((data ?? []) as VehiculoFicha[])
        setCargando(false)
      })
  }, [])

  const veMinimo = perfil?.rol === 'admin'
  const puedeCrear = perfil?.rol === 'admin' || perfil?.rol === 'gerencia'
  const q = busqueda.trim().toLowerCase()
  const filtrados = vehiculos.filter((v) =>
    (!q || `${v.id_interno} ${v.marca} ${v.modelo} ${v.anio} ${v.vin ?? ''} ${v.torre ?? ''}`.toLowerCase().includes(q))
    && (!etapa || String(v.estado_proceso_id) === etapa)
    && (!soloAtrasadas || (diasDesde(v.fecha_compra) ?? 0) >= dias_alerta)
  )
  const nombreEstado = (id: number) => estados.find((e) => e.id === id)?.nombre ?? '—'

  return (
    <div>
      <PageHeader
        titulo="Inventario"
        descripcion={`${vehiculos.length} unidades activas. Haz clic en una para ver su expediente.`}
        acciones={puedeCrear && <Link to="/vehiculo/nuevo" className="btn btn-primario">+ Nueva unidad</Link>}
      />

      <div className="filtros">
        <input className="input" placeholder="Buscar por marca, modelo, año, folio, serie o torre…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <select className="select" value={etapa} onChange={(e) => setEtapa(e.target.value)}>
          <option value="">Todas las etapas</option>
          {estados.filter((e) => !e.es_final).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <label className="check">
          <input type="checkbox" checked={soloAtrasadas} onChange={(e) => setSoloAtrasadas(e.target.checked)} />
          Solo con {dias_alerta}+ días
        </label>
        {filtrados.length !== vehiculos.length && <span className="texto-suave filtros-cuenta">{filtrados.length} de {vehiculos.length}</span>}
      </div>

      {cargando ? <Cargando /> : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Unidad</th>
                <th>Etapa</th>
                <th>Días</th>
                <th>Kilometraje</th>
                <th>Estado comercial</th>
                <th>Documentación</th>
                <th className="num">Precio autorizado</th>
                {veMinimo && <th className="num">Precio mínimo</th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((v) => (
                <tr key={v.id} className="clic" onClick={() => navigate(`/vehiculo/${v.id}`)}>
                  <td>
                    <span className="unidad-nombre">{v.marca} {v.modelo} {v.anio}</span>
                    <span className="unidad-folio">{v.id_interno}</span>
                  </td>
                  <td className="texto-suave">{nombreEstado(v.estado_proceso_id)}</td>
                  <td><DiasBadge dias={diasDesde(v.fecha_compra)} /></td>
                  <td>{km(v.kilometraje_final ?? v.kilometraje)}</td>
                  <td><EtiquetaBadge etiqueta={etiqueta(ESTADO_COMERCIAL, v.estado_comercial)} /></td>
                  <td><EtiquetaBadge etiqueta={etiqueta(ESTADO_DOCUMENTAL, v.estado_documental)} /></td>
                  <td className="num">{mxn(v.precio_autorizado)}</td>
                  {veMinimo && <td className="num">{mxn(v.precio_minimo)}</td>}
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={8} className="vacio">{q || etapa || soloAtrasadas ? 'Ninguna unidad coincide con los filtros.' : 'Todavía no hay unidades activas.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
