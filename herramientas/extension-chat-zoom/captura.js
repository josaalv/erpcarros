// Lee el panel de chat del Zoom web cada segundo y agrega al registro solo
// los renglones nuevos (une la foto anterior con la nueva por su traslape,
// así los mensajes que se repiten entre lecturas no se duplican).
// No escribe nada en Zoom: solo lee el texto que ya se ve en pantalla.

const CLAVE = 'chatSubasta'
let anterior = []


/** Textos fijos de Zoom que no son mensajes (encabezado, pie, avisos). */
const RUIDO = [
  /^chat$/i, /chatting as a guest/i, /^messages (sent|addressed) /i, /^guests like you/i,
  /^all others can see/i, /^got it$/i, /new messages?$/i, /who can see your messages/i, /^to:/i,
  /meeting group chat$/i, /^recording on$/i, /^(enviar|send) (mensaje|message)/i, /^type message/i,
]
const esRuido = (s) => RUIDO.some((r) => r.test(s))

/** Ancestro común más cercano de varios elementos. */
function ancestroComun(els) {
  let a = els[0]
  for (const el of els.slice(1)) { while (a && !a.contains(el)) a = a.parentElement }
  return a
}

const HORA_EN_TEXTO = /\b\d{1,2}:\d{2}\s?(AM|PM|a\.?\s?m\.?|p\.?\s?m\.?)\b/i
const PANEL = '[class*="chat" i], [aria-label*="chat" i], [id*="chat" i]'

/** Método de la 0.1: el elemento "chat" con más texto (sin la caja de escribir). */
function panelPorClase() {
  const candidatos = [...document.querySelectorAll(PANEL)]
    .filter((el) => el.innerText && el !== document.body && !el.matches('textarea, input, [contenteditable="true"]'))
  candidatos.sort((x, y) => y.innerText.length - x.innerText.length)
  return candidatos[0] ?? null
}

/**
 * La lista de mensajes: el ancestro común de los textos que traen hora
 * ("01. PS1063 02:42 PM": en Zoom web la hora va pegada al nombre). Solo se
 * cuentan horas dentro del panel de chat, para no subir hasta toda la página.
 * Si no hay horas visibles, se usa el panel completo (el ruido se filtra).
 */
function panelChat() {
  const panel = panelPorClase()
  if (!panel) return null
  const textos = []
  const w = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (HORA_EN_TEXTO.test(n.textContent ?? '') && n.parentElement) textos.push(n.parentElement)
  }
  if (textos.length >= 2) return ancestroComun(textos) ?? panel
  // Con un solo mensaje visible todavía no se sabe dónde está la lista: esperar.
  if (textos.length === 1) return null
  return panel
}

function renglones(el) {
  return el.innerText.split('\n').map((s) => s.trim()).filter((s) => s && !esRuido(s))
}

/** Parte de `nuevo` que no estaba al final de `previo`. */
function soloLoNuevo(previo, nuevo) {
  if (!previo.length) return nuevo
  const max = Math.min(previo.length, nuevo.length)
  for (let k = max; k > 0; k--) {
    let igual = true
    for (let i = 0; i < k; i++) {
      if (previo[previo.length - k + i] !== nuevo[i]) { igual = false; break }
    }
    if (igual) return nuevo.slice(k)
  }
  // Sin traslape (el usuario subió el scroll o Zoom recargó la lista): no
  // agregar nada para no meter un bloque viejo duplicado.
  return nuevo.length < previo.length ? [] : nuevo
}

async function leer() {
  const el = panelChat()
  if (!el) return
  const ahora = renglones(el)
  const nuevos = soloLoNuevo(anterior, ahora)
  anterior = ahora
  if (!nuevos.length) return
  const datos = (await chrome.storage.local.get(CLAVE))[CLAVE] ?? { lineas: [], inicio: new Date().toISOString(), titulo: document.title }
  datos.lineas.push(...nuevos)
  datos.actualizado = new Date().toISOString()
  await chrome.storage.local.set({ [CLAVE]: datos })
}

setInterval(() => { leer().catch(() => {}) }, 1000)
