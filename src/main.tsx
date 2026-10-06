import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { completarConexionDropbox } from './lib/dropbox'

// Si Dropbox acaba de regresar con ?code=…, se completa la conexión antes de
// montar el router (el código viene en la query, no en el hash).
completarConexionDropbox()
  .then((error) => { if (error) sessionStorage.setItem('dropbox:error', error) })
  .catch((e) => sessionStorage.setItem('dropbox:error', String(e)))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
