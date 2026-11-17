import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Estilos compartidos y públicos primero; cada hoja de rol va después para
// que sus reglas específicas tengan prioridad sobre las comunes.
import "./assets/style/index.css";
import "./assets/style/admin/index.css";
import "./assets/style/cliente/index.css";
import "./assets/style/bodeguero/index.css";
import "./assets/style/vendedor/index.css";

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
