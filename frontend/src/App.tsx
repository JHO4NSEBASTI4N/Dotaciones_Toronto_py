// src/App.tsx

import type { ReactElement } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/index";
import Login from "./pages/login";
import Registro from "./pages/registro";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import { autenticacion } from "./services/autenticacion";

// --- IMPORTACIONES NUEVAS (Vendedor) ---
import PanelVendedor from './pages/Vendedor/Panel';
import VentasVendedor from './pages/Vendedor/Ventas';
import PedidosVendedor from './pages/Vendedor/Pedidos';
import DevolucionesVendedor from './pages/Vendedor/Devoluciones';
import PerfilVendedor from './pages/Vendedor/perfil';
// --------------------------------------

// Si no hay sesión iniciada, manda al login
function RutaProtegida({ children }: { children: ReactElement }) {
  const usuario = autenticacion.usuarioActual();
  if (!autenticacion.estaAutenticado()) {
    return <Navigate to="/login" replace />;
  }
  
  // REDIRECCIÓN POR ROL
  const rol = usuario?.id_rol_fk;
  if (rol === 3) return <Navigate to="/vendedor/panel" replace />; // Vendedor
  if (rol === 2) return <Navigate to="/clientes" replace />;      // Cliente
  if (rol === 4) return <Navigate to="/bodeguero/panel" replace />; // Bodeguero
  
  // Si es Admin (1) o rol desconocido, deja pasar al hijo (Dashboard General)
  return children;
}

// Si ya hay sesión, no tiene sentido mostrar login ni registro
function RutaPublica({ children }: { children: ReactElement }) {
  const usuario = autenticacion.usuarioActual();
  if (autenticacion.estaAutenticado()) {
    const rol = usuario?.id_rol_fk;
    if (rol === 3) return <Navigate to="/vendedor/panel" replace />;
    if (rol === 2) return <Navigate to="/clientes" replace />;
    if (rol === 4) return <Navigate to="/bodeguero/panel" replace />;
    return <Navigate to="/dashboard" replace />; // Admin
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Página principal */}
        <Route path="/" element={<Index />} />

        <Route
          path="/login"
          element={
            <RutaPublica>
              <Login />
            </RutaPublica>
          }
        />

        <Route
          path="/registro"
          element={
            <RutaPublica>
              <Registro />
            </RutaPublica>
          }
        />

        {/* DASHBOARD GENERAL (Admin) */}
        <Route
          path="/dashboard"
          element={
            <RutaProtegida>
              <Dashboard />
            </RutaProtegida>
          }
        />

        {/* CLIENTES */}
        <Route
          path="/clientes"
          element={
            <RutaProtegida>
              <Clientes />
            </RutaProtegida>
          }
        />

        {/* VENDEDOR */}
        <Route
          path="/vendedor/panel"
          element={
            <RutaProtegida>
              <PanelVendedor />
            </RutaProtegida>
          }
        />
        <Route
          path="/vendedor/ventas"
          element={
            <RutaProtegida>
              <VentasVendedor />
            </RutaProtegida>
          }
        />
        <Route
          path="/vendedor/pedidos"
          element={
            <RutaProtegida>
              <PedidosVendedor />
            </RutaProtegida>
          }
        />
        <Route
          path="/vendedor/devoluciones"
          element={
            <RutaProtegida>
              <DevolucionesVendedor />
            </RutaProtegida>
          }
        />
        <Route
          path="/vendedor/perfil"
          element={
            <RutaProtegida>
              <PerfilVendedor />
            </RutaProtegida>
          }
        />

        {/* BODEGUERO (Por crear si es necesario) */}
        {/* <Route path="/bodeguero/panel" element={<RutaProtegida><PanelBodeguero /></RutaProtegida>} /> */}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;