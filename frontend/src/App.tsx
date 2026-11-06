// src/App.tsx

import type { ReactElement } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import { autenticacion } from "./services/autenticacion";

// Si no hay sesión iniciada, manda al login
function RutaProtegida({ children }: { children: ReactElement }) {
  if (!autenticacion.estaAutenticado()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Si ya hay sesión, no tiene sentido mostrar login ni registro
function RutaPublica({ children }: { children: ReactElement }) {
  if (autenticacion.estaAutenticado()) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
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

        <Route
          path="/dashboard"
          element={
            <RutaProtegida>
              <Dashboard />
            </RutaProtegida>
          }
        />

        <Route
          path="/clientes"
          element={
            <RutaProtegida>
              <Clientes />
            </RutaProtegida>
          }
        />

        {/* "/" aún no tiene página: va al login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;