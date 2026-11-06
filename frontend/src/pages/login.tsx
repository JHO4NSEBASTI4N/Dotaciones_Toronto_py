// src/pages/Login.tsx

import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { autenticacion } from "../services/autenticacion";
import logo from "../assets/logo-negro.png";

type TipoAlerta = "error" | "inhabilitado" | "logout" | "registro" | null;
type EstadoCampo = "" | "is-valid" | "is-invalid";

function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Equivale a ${param.error}, ${param.inhabilitado}, ${param.logout} y ${param.registro}
  const [alerta, setAlerta] = useState<TipoAlerta>(() => {
    if (searchParams.has("error")) return "error";
    if (searchParams.has("inhabilitado")) return "inhabilitado";
    if (searchParams.has("logout")) return "logout";
    if (searchParams.has("registro")) return "registro";
    return null;
  });

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [estadoCorreo, setEstadoCorreo] = useState<EstadoCampo>("");
  const [estadoPassword, setEstadoPassword] = useState<EstadoCampo>("");
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);

  const validarCampo = (campo: HTMLInputElement): boolean => {
    const valido = campo.checkValidity();
    const estado: EstadoCampo = valido ? "is-valid" : "is-invalid";
    if (campo.name === "username") setEstadoCorreo(estado);
    if (campo.name === "password") setEstadoPassword(estado);
    return valido;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let valido = true;
    e.currentTarget.querySelectorAll("input").forEach((campo) => {
      if (!validarCampo(campo as HTMLInputElement)) valido = false;
    });
    if (!valido) return;

    setAlerta(null);
    setCargando(true);

    try {
      await autenticacion.login({ correo, password });
      navigate("/dashboard");
    } catch (err) {
      const mensaje = err instanceof Error ? err.message.toLowerCase() : "";
      if (mensaje.includes("inhabilitad")) {
        setAlerta("inhabilitado");
      } else {
        setAlerta("error");
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      {/* LOADER */}
      {cargando && (
        <div id="loader-overlay">
          <div className="loader-box">
            <div className="loader-logo-wrapper">
              <div className="loader-ring"></div>
              <img src={logo} alt="Logo" />
            </div>
            <div className="loader-text">Cargando...</div>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="navbar-dt">
        <div className="container">
          <Link to="/" className="navbar-brand">
            <img src={logo} alt="Logo" />
            <span>Dotaciones Toronto</span>
          </Link>
          <div className="navbar-actions">
            <Link to="/" className="btn-ghost">Inicio</Link>
            <Link to="/login" className="btn-ghost">Iniciar sesión</Link>
            <Link to="/registro" className="btn-primary-dt">Registrarse</Link>
          </div>
        </div>
      </nav>

      <div className="page-content">
        <div className="login-card">
          <div className="text-center mb-3">
            <div style={{ width: 100, height: 100, margin: "0 auto", overflow: "hidden" }}>
              <img
                src={logo}
                alt="Logo"
                style={{ width: 100, height: 100, objectFit: "contain", display: "block" }}
              />
            </div>
            <div className="login-title mt-2">Dotaciones Toronto</div>
            <div className="login-subtitle">Inicia sesión para continuar</div>
          </div>

          {alerta === "error" && (
            <div className="alert alert-danger p-2 fs-6">
              <i className="bi bi-exclamation-circle me-1"></i> Correo o contraseña incorrectos.
            </div>
          )}
          {alerta === "inhabilitado" && (
            <div className="alert alert-warning p-2 fs-6">
              <i className="bi bi-ban me-1"></i> Usuario inhabilitado. Contacte al administrador.
            </div>
          )}
          {alerta === "logout" && (
            <div className="alert alert-info p-2 fs-6">
              <i className="bi bi-check-circle me-1"></i> Sesión cerrada correctamente.
            </div>
          )}
          {alerta === "registro" && (
            <div className="alert alert-success p-2 fs-6">
              <i className="bi bi-check-circle me-1"></i> Registro exitoso. Ya puedes iniciar sesión.
            </div>
          )}

          <form noValidate id="formLogin" onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="username">
                Correo electrónico
              </label>
              <input
                type="email"
                name="username"
                id="username"
                className={`form-control ${estadoCorreo}`}
                placeholder="correo@ejemplo.com"
                required
                autoFocus
                value={correo}
                onChange={(e) => {
                  setCorreo(e.target.value);
                  validarCampo(e.target);
                }}
              />
              <div className="invalid-feedback">Ingrese un correo electrónico válido.</div>
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold" htmlFor="password">
                Contraseña
              </label>
              <div className="input-group">
                <input
                  type={verPassword ? "text" : "password"}
                  name="password"
                  id="password"
                  className={`form-control ${estadoPassword}`}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    validarCampo(e.target);
                  }}
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  id="togglePassword"
                  onClick={() => setVerPassword((v) => !v)}
                >
                  <i className={`bi ${verPassword ? "bi-eye-slash" : "bi-eye"}`} id="eyeIcon"></i>
                </button>
              </div>
              <div className="invalid-feedback">
                La contraseña debe tener al menos 6 caracteres.
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-login w-100" disabled={cargando}>
              <i className="bi bi-box-arrow-in-right me-1"></i> Iniciar sesión
            </button>
          </form>

          <div className="text-center mt-3">
            <Link
              to="/registro"
              className="text-decoration-none text-secondary"
              style={{ fontSize: "0.9rem" }}
            >
              ¿No tienes cuenta? Regístrate
            </Link>
          </div>
          <div className="text-center mt-3 footer-text">© Dotaciones Toronto 2026</div>
        </div>
      </div>
    </>
  );
}

export default Login;