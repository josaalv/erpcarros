/**
 * Embedder de Dropbox (dropins.js): muestra una carpeta compartida dentro
 * del sistema aunque quien la comparte haya desactivado las descargas (la
 * API niega los archivos, pero ver sí está permitido). Requiere registrar el
 * dominio del sistema en la app de Dropbox ("Chooser / Saver / Embedder
 * domains"). El script toma la App key de su atributo al cargarse.
 */

interface DropboxDropins {
  embed: (opciones: { link: string; file?: { zoom?: 'best' | 'fit' }; folder?: { view?: 'list' | 'grid'; headerSize?: 'normal' | 'small' } }, el: HTMLElement) => unknown
  unmount: (embed: unknown) => void
  isBrowserSupported?: () => boolean
}

declare global {
  interface Window { Dropbox?: DropboxDropins }
}

let cargando: Promise<DropboxDropins> | null = null

export function cargarEmbedder(appKey: string): Promise<DropboxDropins> {
  if (window.Dropbox?.embed) return Promise.resolve(window.Dropbox)
  cargando ??= new Promise((ok, mal) => {
    const s = document.createElement('script')
    s.src = 'https://www.dropbox.com/static/api/2/dropins.js'
    s.id = 'dropboxjs'
    s.dataset.appKey = appKey
    s.onload = () => (window.Dropbox?.embed ? ok(window.Dropbox) : mal(new Error('Dropbox no cargó su visor.')))
    s.onerror = () => { cargando = null; mal(new Error('No se pudo cargar el visor de Dropbox.')) }
    document.head.appendChild(s)
  })
  return cargando
}
