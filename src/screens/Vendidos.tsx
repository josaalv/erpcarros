import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { mxn, porcentaje } from '../lib/helpers'
import { th, td } from '../lib/ui'
import type { VehiculoFicha, Venta, CierreFinanciero, Comision } from '../types'

type VentaConComisionista = Venta & { comisionista?: { nombre: string } | null }

/**
 * Etapa 4 del ciclo: el vehículo ya se vendió. Sección propia, separada de
 * Inventario (que solo muestra unidades activas) — aquí vive la
 * información final de cada venta: precio final, comisión (si aplica) y el
 * cierre financiero ya calculado en Ventas.tsx.
 */
export default function Vendidos() {
  const { perfil } = useAuth()
  const [vehiculos, setVehiculos] = useState<VehiculoFicha[]>([])
  const [ventas, setVentas] = useState<VentaConComisionista[]>([])
  const [cierres, setCierres] = useState<CierreFinanciero[]>([])
  const [comisiones, setComisiones] = useState<Comision[]>([])
  const [cargando, setCargando] = useState(true)

  const veFinanciero = perfil?.rol === 'admin'

  useEffect(() => {
    if (!supabase) return
    Promise.all([
      supabase.from('v_vehiculo_ficha').select('*').eq('estado_comercial', 'vendido').order('id_interno'),
      supabase.from('venta').select('*, comisionista:comisionista_id(nombre)').eq('estado', 'completada'),
      supabase.from('cierre_financiero').select('*'),
      supabase.from('comision').select('*'),
    ]).then(([v, ve, ci, co]) => {
      setVehiculos((v.data ?? []) as VehiculoFicha[])
      setVentas((ve.data ?? []) as unknown as VentaConComisionista[])
      setCierres((ci.data ?? []) as CierreFinanciero[])
      setComisiones((co.data ?? []) as Comision[])
      setCargando(false)
    })
  }, [])

  if (cargando) return <p>Cargando…</p>

  return (
    <div>
      <h1 style={{ font: '400 26px Georgia, serif', margin: '0 0 4px' }}>Vendidos</h1>
      <p style={{ color: '#8b8578', fontSize: 12.5, marginTop: 0, marginBottom: 20 }}>
        {vehiculos.length} unidades con el ciclo terminado.
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: '#fff' }}>
        <thead>
          <tr style={{ background: '#faf9f6' }}>
            {['Unidad', 'Fecha de venta', 'Canal', 'Precio final', 'Comisionista', 'Comisión',
              veFinanciero ? 'Utilidad' : null, veFinanciero ? 'Margen' : null, veFinanciero ? 'ROI' : null]
              .filter(Boolean).map((h) => <th key={h} style={th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {vehiculos.map((v) => {
            const venta = ventas.find((ve) => ve.vehiculo_id === v.id)
            const cierre = venta ? cierres.find((c) => c.venta_id === venta.id) : null
            const comision = venta ? comisiones.find((c) => c.venta_id === venta.id) : null
            const montoComision = comision?.monto_pagado ?? comision?.monto_autorizado ?? comision?.monto_estimado ?? null
            return (
              <tr key={v.id} style={{ borderTop: '1px solid #f0ede6' }}>
                <td style={td}>
                  <Link to={`/vehiculo/${v.id}`} style={{ color: '#1c1b19' }}>{v.marca} {v.modelo} {v.anio} <span style={{ color: '#8b8578' }}>· {v.id_interno}</span></Link>
                </td>
                <td style={td}>{venta?.fecha_venta ?? '—'}</td>
                <td style={td}>{venta?.canal ?? '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>{mxn(venta?.precio_acordado ?? null)}</td>
                <td style={td}>{venta?.comisionista?.nombre ?? '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>{montoComision !== null ? mxn(montoComision) : '—'}</td>
                {veFinanciero && <td style={{ ...td, textAlign: 'right' }}>{cierre ? mxn(cierre.utilidad_bruta) : '—'}</td>}
                {veFinanciero && <td style={{ ...td, textAlign: 'right' }}>{cierre ? porcentaje(cierre.margen) : '—'}</td>}
                {veFinanciero && <td style={{ ...td, textAlign: 'right' }}>{cierre ? porcentaje(cierre.roi) : '—'}</td>}
              </tr>
            )
          })}
          {vehiculos.length === 0 && (
            <tr><td colSpan={veFinanciero ? 9 : 6} style={{ padding: 20, textAlign: 'center', color: '#8b8578' }}>Sin unidades vendidas todavía.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
