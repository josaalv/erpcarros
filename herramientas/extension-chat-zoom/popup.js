const CLAVE = 'chatSubasta'

async function pintar() {
  const datos = (await chrome.storage.local.get(CLAVE))[CLAVE]
  const lineas = datos?.lineas ?? []
  document.getElementById('cuenta').textContent = lineas.length
  document.getElementById('ultimos').textContent = lineas.slice(-8).join('\n') || '—'
}

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
