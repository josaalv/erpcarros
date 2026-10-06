import { interpretarPagina, type UnidadContrato } from './contratoTexto'
import { interpretarListado, type Listado, type ItemTexto as ItemListado } from './listadoTexto'

export type { UnidadContrato, Listado }

interface ItemTexto { str: string; hasEOL?: boolean }

/** Lee un PDF de contratos (una unidad por página). Las librerías se cargan solo al usarse. */
export async function cargarPdfjs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs
}

export async function leerContratos(archivo: File): Promise<UnidadContrato[]> {
  const pdfjs = await cargarPdfjs()

  const doc = await pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) }).promise
  const unidades: UnidadContrato[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p)
    const contenido = await pagina.getTextContent()
    const texto = (contenido.items as ItemTexto[]).map((it) => it.str + (it.hasEOL ? '\n' : '')).join('')
    const anotaciones = (await pagina.getAnnotations())
      .map((a: { contentsObj?: { str?: string }; contents?: string }) => a.contentsObj?.str ?? a.contents ?? '')
      .filter(Boolean)
    const unidad = interpretarPagina(p, texto, anotaciones)
    if (unidad) unidades.push(unidad)
  }
  return unidades
}

/** Copia una sola página del PDF a un archivo nuevo (el contrato de esa unidad). */
export async function extraerPagina(archivo: File, pagina: number): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib')
  const origen = await PDFDocument.load(await archivo.arrayBuffer())
  const destino = await PDFDocument.create()
  const [copia] = await destino.copyPages(origen, [pagina - 1])
  destino.addPage(copia)
  const bytes = await destino.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

/** Lee el "Listado de Unidades a Subastar": texto con su posición en la página. */
export async function leerListado(archivo: File): Promise<Listado> {
  const pdfjs = await cargarPdfjs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) }).promise
  const paginas: ItemListado[][] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const contenido = await (await doc.getPage(p)).getTextContent()
    paginas.push((contenido.items as { str: string; transform: number[] }[])
      .map((it) => ({ x: it.transform[4], y: it.transform[5], s: it.str })))
  }
  return interpretarListado(paginas)
}
