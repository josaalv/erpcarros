const CLAVE = 'chatSubasta'

async function pintar() {
  const datos = (await chrome.storage.local.get(CLAVE))[CLAVE]
  const lineas = datos?.lineas ?? []
  document.getElementById('cuenta').textContent = lineas.length
  document.getElementById('ultimos').textContent = lineas.slice(-8).join('\n') || '—'
  const e = (await chrome.storage.local.get('chatSubastaEstado')).chatSubastaEstado
  const vivo = e && Date.now() - e.hora < 5000
  document.getElementById('estado').textContent = !vivo
    ? '⚠️ No está leyendo esta reunión. Presiona "Activar en esta pestaña".'
    : e.panel ? `✅ Leyendo el chat (${e.visibles} renglones en pantalla).` : '⚠️ Activa, pero no encuentra el chat: abre el panel de Chat de Zoom.'
}

document.getElementById('activar').addEventListener('click', async () => {
  document.getElementById('estado').textContent = 'Activando…'
  await chrome.runtime.sendMessage('inyectar')
  setTimeout(pintar, 2000)
})

document.getElementById('descargar').addEventListener('click', async () => {
  const datos = (await chrome.storage.local.get(CLAVE))[CLAVE]
  if (!datos?.lineas?.length) return
  const blob = new Blob([datos.lineas.join('\n')], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `chat_subasta_${(datos.inicio ?? '').slice(0, 10)}.txt`
  a.click()
})

document.getElementById('borrar').addEventListener('click', async () => {
  if (!confirm('¿Borrar el chat guardado? Descárgalo antes si lo necesitas.')) return
  await chrome.storage.local.remove(CLAVE)
  pintar()
})

pintar()
setInterval(pintar, 1500)
