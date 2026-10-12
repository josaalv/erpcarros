import type { CuentaSocio, MovimientoSocio } from '../types'

export const TIPO_MOVIMIENTO: Record<MovimientoSocio['tipo'], string> = {
  saldo_inicial: 'Saldo inicial',
  aporte: 'Aporte al fondo',
  retiro: 'Retiro',
  ajuste: 'Ajuste',
  compra: 'Compra de unidad',
  gasto: 'Gasto de unidad',
  prestamo_dado: 'Préstamo que dio',
  prestamo_recibido: 'Préstamo recibido',
  prestamo_cobrado: 'Le pagaron un préstamo',
  prestamo_pagado: 'Pagó un préstamo',
}

/**
 * Lo más que un socio puede retirar: su % de pertenencia sobre el fondo
 * líquido total (regla del negocio), sin pasar de lo que él tiene líquido.
 */
export function retiroMaximo(cuenta: CuentaSocio, cuentas: CuentaSocio[]): number {
  const liquidoTotal = cuentas.reduce((a, c) => a + Math.max(c.liquido, 0), 0)
  const porProporcion = (cuenta.pertenencia ?? 0) * liquidoTotal
  return Math.max(0, Math.floor(Math.min(cuenta.liquido, porProporcion) * 100) / 100)
}
