// src/pages/Vendedor/Panel.tsx

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { autenticacion } from '../../services/autenticacion';
// import { ventas, pedidos, devoluciones } from '../../services/api'; // Descomentar cuando el backend esté listo

const PanelVendedor = () => {
  const navigate = useNavigate();
  const usuario = autenticacion.usuarioActual();
  
  const [resumen, setResumen] = useState<{
    ventas: number;
    ingresos: number;
    pedidos: number;
    devoluciones: number;
  } | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Lógica simulada: En producción, filtrar por usuario.id_usuario y rol=3 (Vendedor)
    setTimeout(() => {
      setResumen({
        ventas: 12,
        ingresos: 4500000,
        pedidos: 5,
        devoluciones: 1
      });
      setCargando(false);
    }, 500);
  }, []);

  const cerrarSesion = () => {
    autenticacion.logout();
    navigate("/login?logout");
  };

  const formatoMoneda = (valor: number) =>
    valor.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

  return (
    <>
      {/* BARRA DE NAVEGACIÓN DEL VENDEDOR (Verde) */}
      <nav className="navbar navbar-dark bg-success shadow-sm">
        <div className="container">
          <span className="navbar-brand fw-bold">Dotaciones Toronto | Vendedor</span>
          <div className="d-flex align-items-center gap-3">
            <span className="text-white small">{usuario?.nombre || 'Vendedor'}</span>
            <button className="btn btn-danger btn-sm" onClick={cerrarSesion}>
              <i className="bi bi-box-arrow-right me-1"></i> Salir
            </button>
          </div>
        </div>
      </nav>

      <div className="container py-4">
        <h3 className="mb-4 text-success">Dashboard del Vendedor</h3>

        {cargando && <div className="alert alert-info">Cargando estadísticas...</div>}

        {resumen && (
          <div className="row g-3 mb-5">
            {/* Tarjetas de Resumen */}
            <div className="col-12 col-md-6 col-lg-3">
              <div className="card shadow-sm h-100 border-success border-3">
                <div className="card-body">
                  <div className="text-secondary small fw-bold">VENTAS COMPLETADAS</div>
                  <div className="fs-4 fw-bold text-success">{resumen.ventas}</div>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-6 col-lg-3">
              <div className="card shadow-sm h-100 border-success border-3">
                <div className="card-body">
                  <div className="text-secondary small fw-bold">INGRESOS TOTALES</div>
                  <div className="fs-4 fw-bold text-primary">{formatoMoneda(resumen.ingresos)}</div>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-6 col-lg-3">
              <div className="card shadow-sm h-100 border-success border-3">
                <div className="card-body">
                  <div className="text-secondary small fw-bold">PEDIDOS PENDIENTES</div>
                  <div className="fs-4 fw-bold text-warning">{resumen.pedidos}</div>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-6 col-lg-3">
              <div className="card shadow-sm h-100 border-success border-3">
                <div className="card-body">
                  <div className="text-secondary small fw-bold">DEVOLUCIONES</div>
                  <div className="fs-4 fw-bold text-danger">{resumen.devoluciones}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ACCIONES RÁPIDAS */}
        <div className="row g-4">
          <div className="col-md-6 col-lg-3">
            <Link to="/vendedor/ventas" className="card h-100 text-decoration-none text-dark">
              <div className="card-body text-center p-4">
                <i className="bi bi-cart-check fs-2 text-success mb-2"></i>
                <h5 className="card-title">Gestionar Ventas</h5>
                <p className="card-text small text-muted">Registrar y ver ventas</p>
              </div>
            </Link>
          </div>
          <div className="col-md-6 col-lg-3">
            <Link to="/vendedor/pedidos" className="card h-100 text-decoration-none text-dark">
              <div className="card-body text-center p-4">
                <i className="bi bi-bag fs-2 text-info mb-2"></i>
                <h5 className="card-title">Pedidos</h5>
                <p className="card-text small text-muted">Ver pedidos activos</p>
              </div>
            </Link>
          </div>
          <div className="col-md-6 col-lg-3">
            <Link to="/vendedor/devoluciones" className="card h-100 text-decoration-none text-dark">
              <div className="card-body text-center p-4">
                <i className="bi bi-arrow-return-right fs-2 text-danger mb-2"></i>
                <h5 className="card-title">Devoluciones</h5>
                <p className="card-text small text-muted">Gestionar devoluciones</p>
              </div>
            </Link>
          </div>
          <div className="col-md-6 col-lg-3">
            <Link to="/vendedor/perfil" className="card h-100 text-decoration-none text-dark">
              <div className="card-body text-center p-4">
                <i className="bi bi-person-circle fs-2 text-secondary mb-2"></i>
                <h5 className="card-title">Mi Perfil</h5>
                <p className="card-text small text-muted">Configuración</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default PanelVendedor;