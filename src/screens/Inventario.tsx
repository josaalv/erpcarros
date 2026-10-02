import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCatalogos } from '../lib/catalogos'
import { mxn, km, etiqueta, ESTADO_COMERCIAL, ESTADO_DOCUMENTAL } from '../lib/helpers'
import { PageHeader, Cargando, EtiquetaBadge } from '../components/Ui'
import type { VehiculoFicha } from '../types'

/** Solo unidades activas; las vendidas viven en Vendidos. */
export default function Inventario() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const { estados } = useCatalogos()
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [busqueda, setBusqueda] = useState('')
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
    !q || `${v.id_interno} ${v.marca} ${v.modelo} ${v.anio}`.toLowerCase().includes(q)
  )
  const nombreEstado = (id: number) => estados.find((e) => e.id === id)?.nombre ?? '—'

  return (
    <div>
      <PageHeader
        titulo="Inventario"
        descripcion={`${vehiculos.length} unidades activas. Haz clic en una para ver su expediente.`}
        acciones={puedeCrear && <Link to="/vehiculo/nuevo" className="btn btn-primario">+ Nueva unidad</Link>}
      />

      <input
        className="input"
        placeholder="Buscar por marca, modelo, año o folio…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ maxWidth: 380, marginBottom: 16 }}
      />

      {cargando ? <Cargando /> : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Unidad</th>
                <th>Etapa</th>
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
                  <td>{km(v.kilometraje_final ?? v.kilometraje)}</td>
                  <td><EtiquetaBadge etiqueta={etiqueta(ESTADO_COMERCIAL, v.estado_comercial)} /></td>
                  <td><EtiquetaBadge etiqueta={etiqueta(ESTADO_DOCUMENTAL, v.estado_documental)} /></td>
                  <td className="num">{mxn(v.precio_autorizado)}</td>
                  {veMinimo && <td className="num">{mxn(v.precio_minimo)}</td>}
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={7} className="vacio">{q ? 'Ninguna unidad coincide con la búsqueda.' : 'Todavía no hay unidades activas.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
