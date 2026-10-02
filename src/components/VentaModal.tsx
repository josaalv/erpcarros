import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useBorrador } from '../lib/useBorrador'
import { CANALES, CANAL_LABEL, FORMAS_PAGO, FORMA_PAGO_LABEL, hoyISO, numeroONull } from '../lib/helpers'
import { Modal, FormBotones, Campo, Alerta } from './Ui'
import type { VehiculoFicha, Venta, Cliente, Comisionista } from '../types'

export function VentaModal({ vehiculo, clientes, comisionistas, onClose, onGuardado }: {
  vehiculo: VehiculoFicha
  clientes: Cliente[]
  comisionistas: Comisionista[]
  onClose: () => void
  onGuardado: () => void
}) {
  const [form, setForm, limpiarBorrador] = useBorrador(`borrador:venta:${vehiculo.id}`, {
    clienteId: '', comisionistaId: '', comisionMonto: '',
    canal: 'directa' as Venta['canal'],
    precio: vehiculo.precio_autorizado ? String(vehiculo.precio_autorizado) : '',
    formaPago: 'transferencia' as Venta['forma_pago'],
    fecha: hoyISO(),
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setGuardando(true)
    setError(null)
    const { data: venta, error: errVenta } = await supabase.from('venta').insert({
      vehiculo_id: vehiculo.id,
      cliente_id: form.clienteId ? Number(form.clienteId) : null,
      comisionista_id: form.comisionistaId ? Number(form.comisionistaId) : null,
      canal: form.canal, precio_acordado: Number(form.precio), forma_pago: form.formaPago, fecha_venta: form.fecha,
    }).select().single()

    if (errVenta || !venta) {
      setGuardando(false)
      setError(errVenta?.message ?? 'No se pudo registrar la venta.')
      return
    }

    if (form.comisionistaId) {
      const { error: errComision } = await supabase.from('comision').insert({
        venta_id: venta.id,
        comisionista_id: Number(form.comisionistaId),
        esquema: 'fijo',
        monto_estimado: numeroONull(form.comisionMonto),
      })
      if (errComision) {
        window.alert(`La venta quedó registrada, pero no se pudo guardar la comisión: ${errComision.message}. Corrígela desde Vendidos al cerrar.`)
      }
    }

    setGuardando(false)
    limpiarBorrador()
    onGuardado()
  }

  return (
    <Modal titulo="Registrar venta" subtitulo={`${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio} · ${vehiculo.id_interno}`} onClose={onClose} ancho={520}>
      <form onSubmit={onSubmit} className="form">
        <div className="form-grid">
          <Campo label="Precio acordado">
            <input className="input" required type="number" step="0.01" min={0} value={form.precio} onChange={(e) => set('precio', e.target.value)} autoFocus />
          </Campo>
          <Campo label="Fecha de venta">
            <input className="input" required type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} />
          </Campo>
        </div>
        <div className="form-grid">
          <Campo label="Canal">
            <select className="select" value={form.canal} onChange={(e) => set('canal', e.target.value as Venta['canal'])}>
              {CANALES.map((c) => <option key={c} value={c}>{CANAL_LABEL[c]}</option>)}
            </select>
          </Campo>
          <Campo label="Forma de pago">
            <select className="select" value={form.formaPago} onChange={(e) => set('formaPago', e.target.value as Venta['forma_pago'])}>
              {FORMAS_PAGO.map((f) => <option key={f} value={f}>{FORMA_PAGO_LABEL[f]}</option>)}
            </select>
          </Campo>
        </div>
        <Campo label="Cliente (opcional)">
          <select className="select" value={form.clienteId} onChange={(e) => set('clienteId', e.target.value)}>
            <option value="">Sin cliente registrado</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Campo>
        <div className="form-grid">
          <Campo label="Comisionista (opcional)">
            <select className="select" value={form.comisionistaId} onChange={(e) => set('comisionistaId', e.target.value)}>
              <option value="">Sin comisionista</option>
              {comisionistas.filter((c) => c.activo || String(c.id) === form.comisionistaId).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
          {form.comisionistaId && (
            <Campo label="Monto de comisión">
              <input className="input" type="number" step="0.01" min={0} value={form.comisionMonto} onChange={(e) => set('comisionMonto', e.target.value)} />
            </Campo>
          )}
        </div>
        {error && <Alerta>{error}</Alerta>}
        <FormBotones onClose={onClose} guardando={guardando} textoGuardar="Registrar venta" />
      </form>
    </Modal>
  )
}
