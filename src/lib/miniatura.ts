import { cargarPdfjs } from './contratoPdf'

/** Imagen pequeña (data URL) de la primera página de un PDF o de una foto; null si no se puede. */
export async function miniatura(archivo: Blob, ancho = 160): Promise<string | null> {
  try {
    if (archivo.type.startsWith('image/')) {
      const bitmap = await createImageBitmap(archivo)
      const escala = ancho / bitmap.width
      return dibujar(ancho, Math.round(bitmap.height * escala), (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h))
    }
    if (archivo.type === 'application/pdf') {
      const pdfjs = await cargarPdfjs()
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) }).promise
      const pagina = await doc.getPage(1)
      const base = pagina.getViewport({ scale: 1 })
      const viewport = pagina.getViewport({ scale: ancho / base.width })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      await pagina.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
      return canvas.toDataURL('image/jpeg', 0.8)
    }
  } catch (e) {
    // archivo dañado o formato que el navegador no puede dibujar: se muestra sin miniatura
    console.warn('miniatura', e)
  }
  return null
}

function dibujar(w: number, h: number, pintar: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  pintar(canvas.getContext('2d')!, w, h)
  return canvas.toDataURL('image/jpeg', 0.8)
}
