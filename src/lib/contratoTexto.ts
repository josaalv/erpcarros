/**
 * Interpreta el texto de una página del "Contrato de compraventa a través de
 * subasta" de Promotora de Subastas (Prosubastas). Separado de la lectura del
 * PDF para poder probarlo sin navegador. El precio, el comprador y el número
 * vienen como anotaciones (texto escrito encima con Nitro), no en el texto.
 */
export interface UnidadContrato {
  pagina: number
  marca: string
  modelo: string
  version: string
  anio: string
  vin: string
  color: string
  numeroMotor: string
  torre: string
  stock: string
  kilometraje: string
  transmision: 'automatica' | 'manual' | ''
  fechaSubasta: string
  locacion: string
  informacionAdicional: string
  vendedor: string
  comprador: string
  precio: string
  comisionBase: number | null
  ivaComision: boolean
  numero: string
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

function sinAcentos(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function campo(texto: string, etiqueta: string): string {
  const m = texto.match(new RegExp(`${etiqueta}\\s*:\\s*([^\\n]+)`, 'i'))
  return m ? m[1].trim() : ''
}

function entre(texto: string, desde: RegExp, hasta: RegExp): string {
  const i = texto.search(desde)
  if (i < 0) return ''
  const resto = texto.slice(i).replace(desde, '')
  const j = resto.search(hasta)
  return (j < 0 ? resto : resto.slice(0, j)).replace(/\s+/g, ' ').trim()
}

function fechaISO(texto: string): string {
  const m = sinAcentos(texto).match(/(\d{1,2})\s*\/\s*([a-z]+)\s*\/\s*(\d{4})/i)
  if (!m) return ''
  const mes = MESES[m[2].toLowerCase()]
  if (!mes) return ''
  return `${m[3]}-${String(mes).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

function titulo(s: string) {
  return s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())
}

/** texto: líneas de la página; anotaciones: textos escritos encima (FreeText). */
export function interpretarPagina(pagina: number, texto: string, anotaciones: string[]): UnidadContrato | null {
  const marca = campo(texto, 'Marca')
  const modelo = campo(texto, 'Modelo')
  const vin = campo(texto, 'N[uú]mero de Serie')
  if (!marca && !modelo && !vin) return null

  const anio = campo(texto, 'A[ñn]o').match(/\d{4}/)?.[0] ?? ''
  const info = entre(texto, /INFORMACI[OÓ]N ADICIONAL DEL VEH[IÍ]CULO\/ART[IÍ]CULO/i, /DATOS DEL VENDEDOR/i)
    .replace(new RegExp(`\\s*${marca}\\s+${modelo}\\s*$`, 'i'), '')
    .trim()

  // "HILUX CHASIS CABINA 2022 AÑO 2022 KM 375601 ..." → versión = lo que va entre el modelo y el año.
  let version = ''
  const antesDelAnio = info.match(/^(.*?)\s+\d{4}\s+A[ÑN]O\b/i)?.[1] ?? ''
  if (antesDelAnio) {
    const sinModelo = antesDelAnio.replace(new RegExp(`^${modelo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '').trim()
    version = sinModelo
  }

  let numeroMotor = campo(texto, 'N[uú]mero de Motor')
  if (!numeroMotor || /^(NV|N\/?A|S\/?N|-+)$/i.test(numeroMotor)) {
    numeroMotor = info.match(/\bMOTOR\s+([A-Z0-9-]{5,})/i)?.[1] ?? ''
  }

  const textoMayus = sinAcentos(info).toUpperCase()
  const transmision = /\b(CVT|AUT|AUTOMATIC[OA]|TIPTRONIC|DSG)\b/.test(textoMayus) ? 'automatica'
    : /\b(STD|ESTANDAR|MANUAL|TM)\b/.test(textoMayus) ? 'manual' : ''

  const comision = texto.match(/COMISI[OÓ]N DE COMPRA:\s*\$\s*([\d,]+(?:\.\d+)?)\s*(m[aá]s\s+I\.?V\.?A)?/i)
  const precio = anotaciones.find((a) => /^\$?\s*[\d,]+\.\d{2}$/.test(a.trim()))
    ?? texto.match(/PRECIO DE VENTA[\s\S]{0,40}?([\d]{1,3}(?:,\d{3})+\.\d{2})/i)?.[1]
    ?? ''
  const comprador = anotaciones.find((a) => /[A-ZÁÉÍÓÚÑ]{3,}\s+[A-ZÁÉÍÓÚÑ]{3,}/.test(a) && !/\d/.test(a)) ?? ''
  const numero = anotaciones.find((a) => /^No\.?\s*\d+$/i.test(a.trim()))?.replace(/^No\.?\s*/i, '') ?? ''

  return {
    pagina,
    marca: titulo(marca),
    modelo: titulo(modelo),
    version,
    anio,
    vin: vin.replace(/\s+/g, '').toUpperCase(),
    color: titulo(campo(texto, 'Color')),
    numeroMotor,
    torre: campo(texto, 'Torre'),
    stock: campo(texto, 'Stock'),
    kilometraje: info.match(/\bKM\s+([\d,.]+)/i)?.[1].replace(/[,.]/g, '') ?? '',
    transmision,
    fechaSubasta: fechaISO(entre(texto, /FECHA DE SUBASTA/i, /LOCACI[OÓ]N/i)),
    locacion: titulo(entre(texto, /LOCACI[OÓ]N/i, /CONDICIONES GENERALES/i)),
    informacionAdicional: info,
    vendedor: entre(texto, /DATOS DEL VENDEDOR/i, /DATOS DEL COMPRADOR/i).split(',')[0].trim(),
    comprador: comprador.replace(/\.$/, '').trim(),
    precio: precio.replace(/[$,\s]/g, ''),
    comisionBase: comision ? Number(comision[1].replace(/,/g, '')) : null,
    ivaComision: Boolean(comision?.[2]),
    numero,
  }
}
