// Lee el panel de chat del Zoom web cada segundo y agrega al registro solo
// los renglones nuevos (une la foto anterior con la nueva por su traslape,
// así los mensajes que se repiten entre lecturas no se duplican).
// No escribe nada en Zoom: solo lee el texto que ya se ve en pantalla.

const CLAVE = 'chatSubasta'
let anterior = []

/** El contenedor del chat: el elemento "chat" con más texto que no sea toda la página. */
function panelChat() {
  const candidatos = [...document.querySelectorAll('[class*="chat" i], [aria-label*="chat" i], [id*="chat" i]')]
    .filter((el) => el.innerText && el.innerText.length > 0 && el !== document.body)
  // Preferir el que contiene mensajes (más renglones), pero no la caja de escribir.
  candidatos.sort((a, b) => b.innerText.length - a.innerText.length)
  return candidatos.find((el) => !el.matches('textarea, input, [contenteditable="true"]')) ?? null
}

function renglones(el) {
  return el.innerText.split('\n').map((s) => s.trim()).filter(Boolean)
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
