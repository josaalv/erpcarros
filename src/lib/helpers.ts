export function mxn(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—'
  return '$' + Math.round(valor).toLocaleString('es-MX')
}

export function porcentaje(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—'
  return (valor * 100).toFixed(1) + '%'
}

export const ROL_LABEL: Record<string, string> = {
  admin: 'Administrador',
  gerencia: 'Gerencia',
  comisionista: 'Comisionista',
  demo: 'Demostración',
}
