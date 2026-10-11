import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { mxn } from '../lib/helpers'
import { MODALIDAD_AYUDA, MODALIDAD_LABEL, ORIGEN_LABEL, type FilaPago, type PropiedadVehiculo } from '../lib/propiedad'
import { Alerta, Badge, Campo, Seccion } from './Ui'
import type { CapitalSocioVehiculo, GastoPago, ModalidadPropiedad, Socio, VehiculoReparto } from '../types'

/* ── Quién pagó un gasto ───────────────────────────────────────────── */

export function PagadoresEditor({ filas, socios, importe, onChange }: {
  filas: FilaPago[]
  socios: Socio[]
  importe: number
  onChange: (f: FilaPago[]) => void
}) {
  const cambiar = (i: number, cambio: Partial<FilaPago>) => onChange(filas.map((f, j) => (j === i ? { ...f, ...cambio } : f)))
  const suma = filas.filter((f) => f.socioId).reduce((a, f) => a + (Number(f.porcentaje) || 0), 0)

  function dividir() {
    // Reparte en partes iguales al agregar a alguien; se puede ajustar después.
    const n = filas.length + 1
    const parte = String(+(100 / n).toFixed(2))
    onChange([...filas.map((f) => ({ ...f, porcentaje: parte })), { socioId: '', porcentaje: parte, origen: 'fondo' }])
  }

  return (
    <div className="pagadores">
      {filas.map((f, i) => (
        <div key={i} className="pagador-fila">
          <select className="select" value={f.socioId} onChange={(e) => cambiar(i, { socioId: e.target.value })} aria-label="Socio que pagó">
            <option value="">{filas.length === 1 ? 'Sin asignar todavía' : 'Elige un socio…'}</option>
            {socios.filter((s) => s.activo || String(s.id) === f.socioId).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          {filas.length > 1 && (
            <div className="pagador-pct">
              <input className="input" type="number" min={0} max={100} step="0.01" value={f.porcentaje}
                onChange={(e) => cambiar(i, { porcentaje: e.target.value })} aria-label="Porcentaje" />
              <span>%</span>
            </div>
          )}
          <select className="select" value={f.origen} onChange={(e) => cambiar(i, { origen: e.target.value as FilaPago['origen'] })} aria-label="Con qué dinero">
            <option value="fondo">{ORIGEN_LABEL.fondo}</option>
            <option value="bolsa">{ORIGEN_LABEL.bolsa}</option>
          </select>
          {filas.length > 1 && (
            <button type="button" className="btn-link peligro" onClick={() => onChange(filas.filter((_, j) => j !== i))}>Quitar</button>
          )}
        </div>
      ))}
      <div className="pagador-pie">
        <button type="button" className="btn-link" onClick={dividir}>+ Dividir con otro socio</button>
        {filas.length > 1 && (
          <span className={Math.abs(suma - 100) > 0.01 ? 'texto-peligro' : 'texto-suave'}>
            Suma {+suma.toFixed(2)}%{importe > 0 ? ` · ${filas.filter((f) => f.socioId).map((f) => mxn(importe * (Number(f.porcentaje) || 0) / 100)).join(' + ')}` : ''}
          </span>
        )}
      </div>
    </div>
  )
}

/** Texto corto para la tabla de gastos: "Ana", "Ana 60% · Luis 40%" o "Sin asignar". */
export function ResumenPagadores({ pagos, socios }: { pagos: GastoPago[]; socios: Socio[] }) {
  if (!pagos.length) return <Badge tono="aviso">Sin asignar</Badge>
  const nombre = (id: number) => socios.find((s) => s.id === id)?.nombre ?? '—'
  return (
    <span>
      {pagos.length === 1
        ? nombre(pagos[0].socio_id)
        : pagos.map((p) => `${nombre(p.socio_id)} ${+(p.porcentaje * 100).toFixed(2)}%`).join(' · ')}
      <span className="unidad-folio">{[...new Set(pagos.map((p) => ORIGEN_LABEL[p.origen]))].join(' / ')}</span>
    </span>
  )
}

/* ── Propiedad de la unidad (pestaña Socios del Expediente) ─────────── */

export function PropiedadUnidad({ vehiculoId, socios, onCambio }: { vehiculoId: number; socios: Socio[]; onCambio: () => void }) {
  const [propiedad, setPropiedad] = useState<PropiedadVehiculo | null>(null)
  const [reparto, setReparto] = useState<VehiculoReparto[]>([])
  const [capital, setCapital] = useState<CapitalSocioVehiculo[]>([])
  const [sinPagador, setSinPagador] = useState<{ monto: number; gastos: number } | null>(null)
  const [filasReparto, setFilasReparto] = useState<{ socioId: string; porcentaje: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  async function cargar() {
    if (!supabase) return
    const [p, r, c, s] = await Promise.all([
      supabase.from('vehiculo').select('modalidad_propiedad, propietario_id').eq('id', vehiculoId).maybeSingle(),
      supabase.from('vehiculo_reparto').select('*').eq('vehiculo_id', vehiculoId),
      supabase.from('v_capital_socio_vehiculo').select('*').eq('vehiculo_id', vehiculoId),
      supabase.from('v_gasto_sin_pagador').select('monto, gastos').eq('vehiculo_id', vehiculoId).maybeSingle(),
    ])
    setPropiedad((p.data as PropiedadVehiculo | null) ?? { modalidad_propiedad: 'unica', propietario_id: null })
    const rep = (r.data ?? []) as VehiculoReparto[]
    setReparto(rep)
    setFilasReparto(rep.length ? rep.map((x) => ({ socioId: String(x.socio_id), porcentaje: String(+(x.porcentaje * 100).toFixed(2)) })) : [{ socioId: '', porcentaje: '' }])
    setCapital((c.data ?? []) as CapitalSocioVehiculo[])
    setSinPagador((s.data as { monto: number; gastos: number } | null) ?? null)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar() }, [vehiculoId])

  async function guardarPropiedad(cambio: Partial<PropiedadVehiculo>) {
    if (!supabase || !propiedad) return
    setError(null)
    setAviso(null)
    const { error: err } = await supabase.from('vehiculo').update(cambio).eq('id', vehiculoId)
    if (err) { setError(err.message); return }
    await cargar()
    onCambio()
  }

  async function guardarReparto() {
    if (!supabase) return
    setError(null)
    setAviso(null)
    const usadas = filasReparto.filter((f) => f.socioId)
    if (new Set(usadas.map((f) => f.socioId)).size !== usadas.length) { setError('Un socio aparece dos veces en el reparto.'); return }
    const suma = usadas.reduce((a, f) => a + Number(f.porcentaje || 0), 0)
    if (usadas.length && Math.abs(suma - 100) > 0.01) { setError(`El reparto suma ${+suma.toFixed(2)}%: debe sumar 100%.`); return }
    const { error: e1 } = await supabase.from('vehiculo_reparto').delete().eq('vehiculo_id', vehiculoId)
    if (e1) { setError(e1.message); return }
    if (usadas.length) {
      const { error: e2 } = await supabase.from('vehiculo_reparto').insert(usadas.map((f) => ({
        vehiculo_id: vehiculoId, socio_id: Number(f.socioId), porcentaje: Number(f.porcentaje) / 100,
      })))
      if (e2) { setError(e2.message); return }
    }
    setAviso('Reparto guardado.')
    await cargar()
  }

  if (!propiedad) return null
  const nombre = (id: number) => socios.find((s) => s.id === id)?.nombre ?? '—'
  const totalCapital = capital.reduce((a, c) => a + c.capital, 0)
  const esExcepcion = propiedad.modalidad_propiedad === 'excepcion'
  const sumaReparto = filasReparto.filter((f) => f.socioId).reduce((a, f) => a + Number(f.porcentaje || 0), 0)

  return (
    <Seccion titulo="Propiedad de la unidad" descripcion="La factura va a nombre de la empresa; aquí se define de quién es el dinero y cómo se reparte al cerrar la venta.">
      {error && <div style={{ marginBottom: 12 }}><Alerta>{error}</Alerta></div>}
      {aviso && <div style={{ marginBottom: 12 }}><Alerta tipo="ok">{aviso}</Alerta></div>}
      <div className="form">
        <div className="form-grid">
          <Campo label="Modalidad" ayuda={MODALIDAD_AYUDA[propiedad.modalidad_propiedad]}>
            <select className="select" value={propiedad.modalidad_propiedad}
              onChange={(e) => guardarPropiedad({ modalidad_propiedad: e.target.value as ModalidadPropiedad })}>
              {(Object.keys(MODALIDAD_LABEL) as ModalidadPropiedad[]).map((m) => <option key={m} value={m}>{MODALIDAD_LABEL[m]}</option>)}
            </select>
          </Campo>
          {propiedad.modalidad_propiedad === 'unica' && (
            <Campo label="Dueño" ayuda="Se propone como quien pagó cada gasto nuevo.">
              <select className="select" value={propiedad.propietario_id ?? ''}
                onChange={(e) => guardarPropiedad({ propietario_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Elige al dueño…</option>
                {socios.filter((s) => s.activo || s.id === propiedad.propietario_id).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </Campo>
          )}
        </div>

        {esExcepcion && (
          <div>
            <div className="card-titulo" style={{ fontSize: 15 }}>Reparto acordado (% del total de la venta)</div>
            <div className="pagadores">
              {filasReparto.map((f, i) => (
                <div key={i} className="pagador-fila">
                  <select className="select" value={f.socioId} aria-label="Socio"
                    onChange={(e) => setFilasReparto(filasReparto.map((x, j) => (j === i ? { ...x, socioId: e.target.value } : x)))}>
                    <option value="">Elige un socio…</option>
                    {socios.filter((s) => s.activo || String(s.id) === f.socioId).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                  <div className="pagador-pct">
                    <input className="input" type="number" min={0} max={100} step="0.01" value={f.porcentaje} aria-label="Porcentaje"
                      onChange={(e) => setFilasReparto(filasReparto.map((x, j) => (j === i ? { ...x, porcentaje: e.target.value } : x)))} />
                    <span>%</span>
                  </div>
                  {filasReparto.length > 1 && (
                    <button type="button" className="btn-link peligro" onClick={() => setFilasReparto(filasReparto.filter((_, j) => j !== i))}>Quitar</button>
                  )}
                </div>
              ))}
              <div className="pagador-pie">
                <button type="button" className="btn-link" onClick={() => setFilasReparto([...filasReparto, { socioId: '', porcentaje: '' }])}>+ Agregar socio</button>
                <span className={Math.abs(sumaReparto - 100) > 0.01 ? 'texto-peligro' : 'texto-suave'}>Suma {+sumaReparto.toFixed(2)}%</span>
                <button type="button" className="btn btn-primario btn-chico" onClick={guardarReparto}>Guardar reparto</button>
              </div>
            </div>
            {!reparto.length && <p className="texto-suave" style={{ margin: '6px 0 0' }}>Todavía no hay reparto guardado: al cerrar la venta se pedirá.</p>}
          </div>
        )}

        {sinPagador && sinPagador.monto > 0 && (
          <Alerta tipo="aviso">
            {sinPagador.gastos} {sinPagador.gastos === 1 ? 'gasto' : 'gastos'} ({mxn(sinPagador.monto)}) sin indicar quién pagó.
            {esExcepcion ? ' En excepción es opcional.' : ' Asígnalos en "Compra y gastos" para que cuenten en el capital de cada socio.'}
          </Alerta>
        )}

        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Socio</th><th className="num">Compra</th><th className="num">Gastos que pagó</th><th className="num">Capital</th>
                <th className="num">{esExcepcion ? 'Le toca de la venta' : 'Participación'}</th>
              </tr>
            </thead>
            <tbody>
              {capital.map((c) => (
                <tr key={c.socio_id}>
                  <td style={{ fontWeight: 500 }}>{nombre(c.socio_id)}</td>
                  <td className="num">{mxn(c.aportado_compra)}</td>
                  <td className="num">{mxn(c.aportado_gastos)}</td>
                  <td className="num">{mxn(c.capital)}</td>
                  <td className="num">
                    {esExcepcion
                      ? (c.participacion_acordada != null ? `${+(c.participacion_acordada * 100).toFixed(2)}%` : '—')
                      : (c.participacion_capital != null ? `${+(c.participacion_capital * 100).toFixed(2)}%` : '—')}
                  </td>
                </tr>
              ))}
              {capital.length === 0 && <tr><td colSpan={5} className="vacio">Todavía nadie tiene capital en esta unidad.</td></tr>}
            </tbody>
            {capital.length > 0 && (
              <tfoot><tr><td>Total</td><td className="num">{mxn(capital.reduce((a, c) => a + c.aportado_compra, 0))}</td><td className="num">{mxn(capital.reduce((a, c) => a + c.aportado_gastos, 0))}</td><td className="num">{mxn(totalCapital)}</td><td /></tr></tfoot>
            )}
          </table>
        </div>
        {propiedad.modalidad_propiedad === 'unica' && capital.length > 1 && (
          <Alerta tipo="aviso">Es propiedad única pero hay {capital.length} socios con capital: revisa si debería ser copropiedad.</Alerta>
        )}
      </div>
    </Seccion>
  )
}
