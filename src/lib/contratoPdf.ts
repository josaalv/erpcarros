import { interpretarPagina, type UnidadContrato } from './contratoTexto'

export type { UnidadContrato }

interface ItemTexto { str: string; hasEOL?: boolean }

/** Lee un PDF de contratos (una unidad por página). Las librerías se cargan solo al usarse. */
export async function leerContratos(archivo: File): Promise<UnidadContrato[]> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

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
