// Chrome solo inyecta la extensión en pestañas abiertas DESPUÉS de instalarla
// o actualizarla. Si la reunión ya estaba abierta, aquí se inyecta a mano.
async function inyectarEnZoom() {
  const tabs = await chrome.tabs.query({ url: 'https://*.zoom.us/*' })
  for (const t of tabs) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: t.id, allFrames: true }, files: ['captura.js'] })
    } catch { /* pestaña sin permiso o cerrándose */ }
  }
}

chrome.runtime.onInstalled.addListener(() => { inyectarEnZoom() })
chrome.runtime.onMessage.addListener((msg, _de, responder) => {
  if (msg === 'inyectar') { inyectarEnZoom().then(() => responder(true)); return true }
})
