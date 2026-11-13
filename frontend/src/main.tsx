import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Una sola hoja de estilos: si hubiera varias (styles/admin.css, styles/login.css...)
// y alguna no se copia al proyecto, Vite falla con "Failed to resolve import".
// Todo el CSS vive aquí, así que no hay forma de que falte un archivo.
import './index.css'

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
