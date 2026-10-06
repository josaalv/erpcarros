/**
 * Interpreta el "Listado de Unidades a Subastar" de Prosubastas (una tabla
 * por página: torre/stock, descripción/VIN, puertas, color, km, equipamiento
 * y un párrafo de documentos por unidad). Trabaja con la POSICIÓN de cada
 * texto en la página (x, y), no con el texto corrido, porque la descripción
 * a veces se parte en dos renglones (ej. "2019 LAND ROVER RANGE ROVER" /
 * "VELAR") y queda arriba y abajo del renglón de la torre. Separado de la
 * lectura del PDF para poder probarlo sin navegador.
 */
export interface ItemTexto { x: number; y: number; s: string }

export interface UnidadListado {
  torre: string
  stock: string
  vin: string
  anio: string
  marca: string
  modelo: string
  version: string
  puertas: number | null
  color: string
  kilometraje: number | null
  equipamiento: string
  transmision: 'automatica' | 'manual' | ''
  vendedor: string
  tipoPersona: string
  fechaFactura: string
  valorFactura: number | null
  documentos: string
}

export interface Listado {
  fechaSubasta: string
  locacion: string
  fechaReporte: string
  unidades: UnidadListado[]
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
}

// Marcas de más de una palabra: sin esta lista "LAND ROVER RANGE ROVER" se
// partiría como marca LAND / modelo ROVER RANGE ROVER.
const MARCAS_COMPUESTAS = ['LAND ROVER', 'MERCEDES BENZ', 'MERCEDES-BENZ', 'ALFA ROMEO', 'ASTON MARTIN', 'ROLLS ROYCE', 'GREAT WALL', 'MINI COOPER']

// Marcas que se escriben en siglas (titulo() las dejaría como "Gmc").
const MARCAS_SIGLAS = ['GMC', 'BMW', 'MG', 'VW', 'JAC', 'BYD', 'DFSK', 'JMC', 'GAC', 'BAIC', 'SEV', 'KTM']

const COL_DESCRIPCION = 100 // x desde donde empieza "Descripción de vehículo"
const COL_PUERTAS = 300     // x desde donde empiezan puertas / color / km / equipamiento
const COL_PRIMERA = 70      // la primera columna (torre / stock / documentos) está antes de esta x

const RE_TORRE = /^[A-Z]{1,5}-\d{1,4}$/
const RE_STOCK = /^\d{3,8}$/
const RE_VIN = /^[A-HJ-NPR-Z0-9]{11,17}$/i

function sinAcentos(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function titulo(s: string) {
  return s.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase())
}

function numero(s: string): number | null {
  const n = Number(s.replace(/[$,\s]/g, ''))
  return Number.isFinite(n) && s.trim() !== '' ? n : null
}

/** "09 de Octubre de 2026" o "05-Oct-2026" → "2026-10-09". */
export function fechaTextoISO(s: string): string {
  const t = sinAcentos(s).toLowerCase()
  const m = t.match(/(\d{1,2})\s*(?:de\s+|-|\/)\s*([a-z]+)\s*(?:de\s+|-|\/)\s*(\d{4})/)
  if (!m) return ''
  const mes = MESES[m[2]]
  return mes ? `${m[3]}-${String(mes).padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''
}

/** "25/06/2019" → "2019-06-25". */
function fechaNumericaISO(s: string): string {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''
}

interface Linea { y: number; items: ItemTexto[]; texto: string }

function agruparLineas(items: ItemTexto[]): Linea[] {
  const ordenados = items.filter((i) => i.s.trim()).sort((a, b) => b.y - a.y || a.x - b.x)
  const lineas: Linea[] = []
  for (const it of ordenados) {
    const ultima = lineas[lineas.length - 1]
    if (ultima && Math.abs(ultima.y - it.y) <= 2) ultima.items.push(it)
    else lineas.push({ y: it.y, items: [it], texto: '' })
  }
  for (const l of lineas) {
    l.items.sort((a, b) => a.x - b.x)
    l.texto = l.items.map((i) => i.s.trim()).join(' ')
  }
  return lineas
}

const primera = (l: Linea) => l.items[0]
const esTorre = (l: Linea) => primera(l).x < COL_PRIMERA && RE_TORRE.test(primera(l).s.trim())
const esStock = (l: Linea) =>
  primera(l).x < COL_PRIMERA && RE_STOCK.test(primera(l).s.trim())
  && l.items.some((i) => i.x >= COL_DESCRIPCION && i.x < COL_PUERTAS + 50 && RE_VIN.test(i.s.trim()))
const esVendedor = (l: Linea) =>
  primera(l).x < COL_PRIMERA && /\bS\.? ?A\.?\b|SOFOM|S\. DE R\.L|\bSAPI\b/i.test(l.texto)
  && !/factura|importe|se entrega/i.test(l.texto)
const esEncabezado = (l: Linea) => /subasta del d[ií]a|n[uú]m\. (torre|stock)|^documentos$|unidades a subastar|fecha de reporte/i.test(sinAcentos(l.texto))

function separarMarcaModelo(descripcion: string): { anio: string; marca: string; modelo: string } {
  const m = descripcion.trim().match(/^(\d{4})\s+(.*)$/)
  const anio = m?.[1] ?? ''
  const resto = (m?.[2] ?? descripcion).trim().toUpperCase()
  const compuesta = MARCAS_COMPUESTAS.find((mc) => resto.startsWith(mc + ' '))
  const marca = compuesta ?? resto.split(/\s+/)[0] ?? ''
  const modelo = resto.slice(marca.length).trim()
  return { anio, marca, modelo }
}

const normalizar = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

/**
 * Versión = primer tramo de "Documentos" sin marca, modelo ni año:
 * "FORD TERRITORY TITANIUM 2025, Persona..." → "TITANIUM".
 * El modelo se compara sin guiones porque el listado dice "F-150" arriba y
 * "F150" en documentos.
 */
function extraerVersion(documentos: string, marca: string, modelo: string, anio: string): string {
  let tramo = documentos.split(',')[0].trim().toUpperCase()
  if (anio) tramo = tramo.replace(new RegExp(`\\s*\\b${anio}\\b\\s*$`), '').trim()
  if (tramo.startsWith(marca + ' ')) tramo = tramo.slice(marca.length).trim()
  const palabras = tramo.split(/\s+/)
  const objetivo = normalizar(modelo)
  for (let n = palabras.length; n >= 1; n--) {
    if (normalizar(palabras.slice(0, n).join('')) === objetivo) return palabras.slice(n).join(' ')
  }
  return tramo
}

export function interpretarListado(paginas: ItemTexto[][]): Listado {
  let fechaSubasta = ''
  let locacion = ''
  let fechaReporte = ''
  let vendedor = ''
  const unidades: UnidadListado[] = []

  for (const items of paginas) {
    const lineas = agruparLineas(items)

    for (const l of lineas) {
      if (!fechaSubasta && /subasta del d/i.test(sinAcentos(l.texto))) {
        fechaSubasta = fechaTextoISO(l.texto)
        locacion = l.texto.split(/Locaci[oó]n:/i)[1]?.trim() ?? ''
      }
      if (/fecha de reporte/i.test(l.texto)) fechaReporte = fechaTextoISO(l.texto)
    }

    // Inicio de la zona libre para la siguiente unidad: después del último
    // renglón de documentos de la anterior (o del encabezado).
    let inicio = 0
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i]
      if (esVendedor(l)) { vendedor = l.texto.trim(); inicio = i + 1; continue }
      if (esEncabezado(l)) { inicio = i + 1; continue }
      if (!esStock(l)) continue

      // Renglones de esta unidad: de `inicio` hasta el del stock.
      const bloque = lineas.slice(inicio, i)
      const torreLinea = [...bloque].reverse().find(esTorre)
      if (!torreLinea) { inicio = i + 1; continue }

      const descripcion = [...bloque, l]
        .flatMap((b) => b.items.filter((it) => it.x >= COL_DESCRIPCION && it.x < COL_PUERTAS && !(b === l)))
        .map((it) => it.s.trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      const derecha = torreLinea.items.filter((it) => it.x >= COL_PUERTAS).map((it) => it.s.trim())
      const puertas = derecha.find((s) => /puertas/i.test(s)) ?? ''
      const km = [...derecha].reverse().find((s) => /^[\d,.]+$/.test(s)) ?? ''
      const color = derecha.find((s) => s !== puertas && s !== km) ?? ''

      const vin = l.items.find((it) => it.x >= COL_DESCRIPCION && RE_VIN.test(it.s.trim()))?.s.trim().toUpperCase() ?? ''
      const equipamiento = l.items.filter((it) => it.x >= COL_PUERTAS).map((it) => it.s.trim()).join(' ')
      const tokens = equipamiento.toUpperCase().split(/[,\s]+/)
      const transmision = tokens.includes('TA') || tokens.includes('CVT') ? 'automatica' : tokens.includes('TM') || tokens.includes('STD') ? 'manual' : ''

      // Documentos: renglones de la primera columna justo después del stock,
      // hasta la siguiente torre, vendedor, encabezado o descripción partida.
      const docs: string[] = []
      let j = i + 1
      for (; j < lineas.length; j++) {
        const d = lineas[j]
        if (primera(d).x >= COL_PRIMERA || esTorre(d) || esStock(d) || esVendedor(d) || esEncabezado(d)) break
        docs.push(d.texto)
      }
      const documentos = docs.join(' ').replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim()

      const { anio, marca, modelo } = separarMarcaModelo(descripcion)
      unidades.push({
        torre: primera(torreLinea).s.trim(),
        stock: primera(l).s.trim(),
        vin,
        anio,
        marca: MARCAS_SIGLAS.includes(marca) ? marca : titulo(marca),
        modelo: titulo(modelo),
        version: extraerVersion(documentos, marca, modelo, anio),
        puertas: Number(puertas.match(/\d+/)?.[0]) || null,
        color: titulo(color),
        kilometraje: numero(km),
        equipamiento,
        transmision,
        vendedor,
        tipoPersona: documentos.match(/Persona\s+(F[IÍ]SICA CON ACTIVIDAD EMPRESARIAL|F[IÍ]SICA|MORAL)/i)?.[1]?.toUpperCase() ?? '',
        fechaFactura: fechaNumericaISO(documentos.match(/Fecha Factura\s+([\d/]+)/i)?.[1] ?? ''),
        valorFactura: numero(documentos.match(/Importe\s+\$?\s*([\d,]+(?:\.\d+)?)/i)?.[1] ?? ''),
        documentos,
      })
      inicio = j
      i = j - 1
    }
  }

  return { fechaSubasta, locacion, fechaReporte, unidades }
}
