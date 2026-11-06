// src/pages/Dashboard.tsx

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { autenticacion } from "../services/autenticacion";
import { dashboard } from "../services/dashboard";
import type { ResumenDashboard } from "../services/dashboard";

function Dashboard() {
  const navigate = useNavigate();
  const usuario = autenticacion.usuarioActual();

  const [resumen, setResumen] = useState<ResumenDashboard | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    dashboard
      .resumen()
      .then(setResumen)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "No se pudo cargar el resumen")
      )
      .finally(() => setCargando(false));
  }, []);

  const cerrarSesion = () => {
    autenticacion.logout();
    navigate("/login?logout");
  };

  const formatoMoneda = (valor: number) =>
    valor.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });

  const tarjetas = resumen
    ? [
        { titulo: "Ventas completadas", valor: resumen.total_ventas, icono: "bi-cart-check" },
        { titulo: "Ingresos totales", valor: formatoMoneda(resumen.ingresos_totales), icono: "bi-cash-coin" },
        { titulo: "Pedidos", valor: resumen.total_pedidos, icono: "bi-bag" },
        { titulo: "Pedidos pendientes", valor: resumen.pedidos_pendientes, icono: "bi-hourglass-split" },
        { titulo: "Clientes", valor: resumen.total_clientes, icono: "bi-people" },
        { titulo: "Productos bajo stock", valor: resumen.productos_bajo_stock, icono: "bi-exclamation-triangle" },
      ]
    : [];

  return (
    <>
      <nav className="navbar navbar-dark bg-dark">
        <div className="container">
          <span className="navbar-brand">Dotaciones Toronto</span>
          <div className="d-flex align-items-center gap-3">
            <Link to="/clientes" className="btn btn-outline-light btn-sm">
              Clientes
            </Link>
            <span className="text-white">{usuario?.nombre}</span>
            <button className="btn btn-danger btn-sm" onClick={cerrarSesion}>
              <i className="bi bi-box-arrow-right me-1"></i> Salir
            </button>
          </div>
        </div>
      </nav>

      <div className="container py-4">
        <h3 className="mb-4">Dashboard</h3>

        {cargando && <p>Cargando...</p>}

        {error && (
          <div className="alert alert-danger">
            <i className="bi bi-exclamation-circle me-1"></i> {error}
          </div>
        )}

        <div className="row g-3">
          {tarjetas.map((t) => (
            <div className="col-12 col-md-6 col-lg-4" key={t.titulo}>
              <div className="card shadow-sm h-100">
                <div className="card-body d-flex align-items-center gap-3">
                  <i className={`bi ${t.icono} fs-1 text-primary`}></i>
                  <div>
                    <div className="text-secondary">{t.titulo}</div>
                    <div className="fs-4 fw-bold">{t.valor}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default Dashboard;