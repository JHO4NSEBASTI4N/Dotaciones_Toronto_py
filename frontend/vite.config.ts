import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    host: true, // acepta conexiones desde fuera de localhost
    port: 5173,

    // Hosts permitidos. Vite bloquea por defecto cualquier host que no sea
    // localhost; esto hace falta para los entornos en linea (Codespaces,
    // contenedores y vistas previas). Para produccion se puede restringir.
    allowedHosts: true,

    // El navegador llama a /api/v1 y Vite lo reenvia al backend en el puerto
    // 8000. Asi no hay problemas de CORS ni de puertos: todo sale del mismo
    // origen. Para apuntar a otro backend, cambia el target.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
