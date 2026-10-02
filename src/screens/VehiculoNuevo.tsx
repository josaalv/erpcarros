import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCatalogos } from '../lib/catalogos'
import { useAuth } from '../lib/auth'
import { useBorrador } from '../lib/useBorrador'
import { useParametros } from '../lib/parametros'
import { hoyISO, numeroONull } from '../lib/helpers'
import { PageHeader, Campo, Alerta, Cargando } from '../components/Ui'

/**
 * Alta de unidad. Etapa y ubicación no se piden: arrancan en
 * comprado/traslado y se administran desde En proceso / En venta. La compra
 * (solo admin, RLS compra_admin) se captura aquí mismo porque sin ella
 * v_costo_vehiculo no tiene costo de adquisición.
 */
export default function VehiculoNuevo() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const { estados, ubicaciones, cargando } = useCatalogos()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const esAdmin = perfil?.rol === 'admin'
  const { comision_subasta } = useParametros()

  const [form, setForm, limpiarBorrador] = useBorrador('borrador:vehiculo-nuevo', {
    id_interno: '', marca: '', modelo: '', version: '', anio: String(new Date().getFullYear()),
    vin: '', kilometraje: '', color: '', transmision: 'automatica',
    fecha_compra: hoyISO(), precio_minimo: '', precio_autorizado: '',
    compra_precio: '', compra_comision: String(comision_subasta), compra_impuestos: '0', compra_iva: '0',
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setError(null)
    setGuardando(true)

    const estadoInicial = estados.find((x) => x.clave === 'comprado') ?? estados[0]
    const ubicacionInicial = ubicaciones.find((u) => u.clave === 'traslado') ?? ubicaciones[0]

    const { data, error: errVeh } = await supabase
      .from('vehiculo')
      .insert({
        id_interno: form.id_interno.trim(),
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
        version: form.version.trim() || null,
        anio: Number(form.anio),
        vin: form.vin.trim() || null,
        kilometraje: numeroONull(form.kilometraje),
        color: form.color.trim() || null,
        transmision: form.transmision,
        estado_proceso_id: estadoInicial?.id,
        ubicacion_id: ubicacionInicial?.id,
        fecha_compra: form.fecha_compra || null,
        precio_minimo: esAdmin ? numeroONull(form.precio_minimo) : null,
        precio_autorizado: numeroONull(form.precio_autorizado),
      })
      .select('id')
      .single()

    if (errVeh || !data) {
      setGuardando(false)
      setError(errVeh?.message.includes('duplicate') ? `Ya existe una unidad con el folio ${form.id_interno}.` : (errVeh?.message ?? 'No se pudo guardar.'))
      return
    }

    if (esAdmin && form.compra_precio.trim()) {
      const { error: errCompra } = await supabase.from('compra').insert({
        vehiculo_id: data.id,
        precio: Number(form.compra_precio),
        comision: Number(form.compra_comision) || 0,
        impuestos: Number(form.compra_impuestos) || 0,
        iva: Number(form.compra_iva) || 0,
      })
      if (errCompra) {
        await supabase.from('vehiculo').delete().eq('id', data.id)
        setGuardando(false)
        setError(`No se pudo guardar la compra, la unidad no se creó: ${errCompra.message}`)
        return
      }
    }

    setGuardando(false)
    limpiarBorrador()
    navigate(`/vehiculo/${data.id}`)
  }

  if (cargando) return <Cargando />

  return (
    <div className="contenido angosto">
      <PageHeader
        titulo="Nueva unidad"
        descripcion="Registra la unidad una sola vez. La etapa y la ubicación se actualizan después desde En proceso y En venta."
        volver={{ to: '/inventario', label: 'Inventario' }}
      />

      <form onSubmit={onSubmit} className="form">
        <div className="card">
          <div className="card-titulo">Datos de la unidad</div>
          <p className="card-sub">Lo que identifica al vehículo.</p>
          <div className="form">
            <div className="form-grid">
              <Campo label="Folio interno" ayuda="Ej. V-1020">
                <input className="input" required value={form.id_interno} onChange={(e) => set('id_interno', e.target.value)} />
              </Campo>
              <Campo label="VIN (opcional)">
                <input className="input" value={form.vin} onChange={(e) => set('vin', e.target.value)} />
              </Campo>
            </div>
            <div className="form-grid">
              <Campo label="Marca"><input className="input" required value={form.marca} onChange={(e) => set('marca', e.target.value)} /></Campo>
              <Campo label="Modelo"><input className="input" required value={form.modelo} onChange={(e) => set('modelo', e.target.value)} /></Campo>
              <Campo label="Versión"><input className="input" value={form.version} onChange={(e) => set('version', e.target.value)} /></Campo>
              <Campo label="Año"><input className="input" required type="number" min={1980} max={2100} value={form.anio} onChange={(e) => set('anio', e.target.value)} /></Campo>
            </div>
            <div className="form-grid">
              <Campo label="Kilometraje de llegada"><input className="input" type="number" min={0} value={form.kilometraje} onChange={(e) => set('kilometraje', e.target.value)} /></Campo>
              <Campo label="Color"><input className="input" value={form.color} onChange={(e) => set('color', e.target.value)} /></Campo>
              <Campo label="Transmisión">
                <select className="select" value={form.transmision} onChange={(e) => set('transmision', e.target.value)}>
                  <option value="automatica">Automática</option>
                  <option value="manual">Manual</option>
                  <option value="otra">Otra</option>
                </select>
              </Campo>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-titulo">Compra</div>
          <p className="card-sub">La fecha de compra arranca el conteo de días en inventario.</p>
          <div className="form-grid">
            <Campo label="Fecha de compra">
              <input className="input" type="date" value={form.fecha_compra} onChange={(e) => set('fecha_compra', e.target.value)} />
            </Campo>
            {esAdmin && (
              <>
                <Campo label="Precio pagado" ayuda="Déjalo vacío si aún no lo sabes">
                  <input className="input" type="number" step="0.01" min={0} value={form.compra_precio} onChange={(e) => set('compra_precio', e.target.value)} />
                </Campo>
                <Campo label="Comisión de subasta">
                  <input className="input" type="number" step="0.01" min={0} value={form.compra_comision} onChange={(e) => set('compra_comision', e.target.value)} />
                </Campo>
                <Campo label="Impuestos">
                  <input className="input" type="number" step="0.01" min={0} value={form.compra_impuestos} onChange={(e) => set('compra_impuestos', e.target.value)} />
                </Campo>
                <Campo label="IVA">
                  <input className="input" type="number" step="0.01" min={0} value={form.compra_iva} onChange={(e) => set('compra_iva', e.target.value)} />
                </Campo>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-titulo">Precio de venta</div>
          <p className="card-sub">Se puede ajustar después desde En venta.</p>
          <div className="form-grid">
            <Campo label="Precio autorizado">
              <input className="input" type="number" min={0} value={form.precio_autorizado} onChange={(e) => set('precio_autorizado', e.target.value)} />
            </Campo>
            {esAdmin && (
              <Campo label="Precio mínimo" ayuda="Solo lo ve el administrador">
                <input className="input" type="number" min={0} value={form.precio_minimo} onChange={(e) => set('precio_minimo', e.target.value)} />
              </Campo>
            )}
          </div>
        </div>

        {error && <Alerta>{error}</Alerta>}

        <div className="form-acciones">
          <button type="button" className="btn btn-secundario" onClick={() => navigate('/inventario')}>Cancelar</button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar unidad'}</button>
        </div>
      </form>
    </div>
  )
}
