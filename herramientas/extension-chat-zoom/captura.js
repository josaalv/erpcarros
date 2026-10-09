// Lee el panel de chat del Zoom web cada segundo y agrega al registro solo
// los renglones nuevos (une la foto anterior con la nueva por su traslape,
// así los mensajes que se repiten entre lecturas no se duplican).
// No escribe nada en Zoom: solo lee el texto que ya se ve en pantalla.

const CLAVE = 'chatSubasta'
let anterior = []

const HORA = /^\d{1,2}:\d{2}\s?(AM|PM|a\.?\s?m\.?|p\.?\s?m\.?)?$/i

/** Textos fijos de Zoom que no son mensajes (encabezado, pie, avisos). */
const RUIDO = [
  /^chat$/i, /^you're chatting as a guest/i, /^messages (sent|addressed) /i, /^guests like you/i,
  /^all others can see/i, /^got it$/i, /new messages?$/i, /^who can see your messages/i, /^to:$/i,
  /^meeting group chat$/i, /^recording on$/i, /^(enviar|send) (mensaje|message)/i, /^type message/i,
]
const esRuido = (s) => RUIDO.some((r) => r.test(s))

/** Ancestro común más cercano de varios elementos. */
function ancestroComun(els) {
  let a = els[0]
  for (const el of els.slice(1)) { while (a && !a.contains(el)) a = a.parentElement }
  return a
}

/**
 * La lista de mensajes: el ancestro común de los textos con hora ("02:37 PM").
 * Así no se toma el encabezado ni el pie del panel, que cambian y rompen la
 * comparación con la lectura anterior.
 */
function panelChat() {
  const horas = [...document.querySelectorAll('span, div, time, p')]
    .filter((el) => el.childElementCount === 0 && HORA.test((el.textContent ?? '').trim()))
  if (horas.length >= 2) return ancestroComun(horas)
  if (horas.length === 1) return horas[0].closest('[role="list"], [role="log"], ul') ?? horas[0].parentElement?.parentElement?.parentElement ?? null
  return null
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
