import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Hojas de estilo, una por área (igual que el proyecto Java separaba
// admin.css, vendedor.css, cliente.css, bodeguero.css, login.css...).
import './styles/index.css'
import './styles/login.css'
import './styles/registro.css'
import './styles/portada.css'
import './styles/admin.css'
import './styles/vendedor.css'
import './styles/bodeguero.css'
import './styles/cliente.css'

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
