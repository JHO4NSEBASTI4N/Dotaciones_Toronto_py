// src/pages/Registro.tsx

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { autenticacion } from "../services/autenticacion";
import logo from "../assets/images/logo negro.png";

type EstadoCampo = "" | "is-valid" | "is-invalid";
type NombreCampo =
  | "nombre"
  | "documento"
  | "correo"
  | "telefono"
  | "direccion"
  | "password";

const FORMULARIO_VACIO: Record<NombreCampo, string> = {
  nombre: "",
  documento: "",
  correo: "",
  telefono: "",
  direccion: "",
  password: "",
};

const ESTADOS_VACIOS: Record<NombreCampo, EstadoCampo> = {
  nombre: "",
  documento: "",
  correo: "",
  telefono: "",
  direccion: "",
  password: "",
};

// Filtros de entrada, igual que en el script original
const filtros: Partial<Record<NombreCampo, RegExp>> = {
  documento: /[^0-9]/g,
  telefono: /[^0-9]/g,
  nombre: /[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g,
};

function Registro() {
  const navigate = useNavigate();

  const [valores, setValores] = useState(FORMULARIO_VACIO);
  const [estados, setEstados] = useState(ESTADOS_VACIOS);
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  const validarCampo = (campo: HTMLInputElement): boolean => {
    const valido = campo.checkValidity();
    const nombre = campo.name as NombreCampo;
    setEstados((prev) => ({ ...prev, [nombre]: valido ? "is-valid" : "is-invalid" }));
    return valido;
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const nombre = e.target.name as NombreCampo;
    const filtro = filtros[nombre];
    if (filtro) e.target.value = e.target.value.replace(filtro, "");

    setValores((prev) => ({ ...prev, [nombre]: e.target.value }));
    validarCampo(e.target);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let valido = true;
    e.currentTarget.querySelectorAll("input").forEach((campo) => {
      if (!validarCampo(campo as HTMLInputElement)) valido = false;
    });
    if (!valido) return;

    setError("");
    setExito("");
    setCargando(true);

    try {
      await autenticacion.registrar(valores);
      setExito("Registro exitoso.");
      navigate("/login?registro");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el registro.");
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

      {/* CONTENIDO PRINCIPAL */}
      <div className="page-content">
        <div className="login-card">
          <div className="text-center mb-3">
            <img src={logo} alt="Logo" className="registro-logo" />
            <div className="login-title mt-1">Dotaciones Toronto</div>
            <div className="login-subtitle">Crear nueva cuenta</div>
          </div>

          {error && <div className="alert alert-danger py-2 px-3 fs-6 mb-3">{error}</div>}
          {exito && <div className="alert alert-success py-2 px-3 fs-6 mb-3">{exito}</div>}

          <form noValidate id="formRegistro" onSubmit={handleSubmit}>
            <div className="row g-3 mb-2">
              <div className="col-md-6">
                <label className="form-label fw-semibold" htmlFor="nombre">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  name="nombre"
                  id="nombre"
                  className={`form-control ${estados.nombre}`}
                  placeholder="Su nombre"
                  pattern="[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+"
                  title="Solo letras"
                  minLength={3}
                  required
                  autoFocus
                  value={valores.nombre}
                  onChange={handleChange}
                />
                <div className="invalid-feedback">Mínimo 3 letras.</div>
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold" htmlFor="documento">
                  Documento
                </label>
                <input
                  type="text"
                  name="documento"
                  id="documento"
                  className={`form-control ${estados.documento}`}
                  placeholder="Núm. de documento"
                  pattern="[0-9]+"
                  minLength={6}
                  maxLength={15}
                  required
                  value={valores.documento}
                  onChange={handleChange}
                />
                <div className="invalid-feedback">Entre 6 y 15 dígitos.</div>
              </div>
            </div>

            <div className="row g-3 mb-2">
              <div className="col-md-6">
                <label className="form-label fw-semibold" htmlFor="correo">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  name="correo"
                  id="correo"
                  className={`form-control ${estados.correo}`}
                  placeholder="correo@ejemplo.com"
                  required
                  value={valores.correo}
                  onChange={handleChange}
                />
                <div className="invalid-feedback">Correo inválido.</div>
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold" htmlFor="telefono">
                  Teléfono
                </label>
                <input
                  type="text"
                  name="telefono"
                  id="telefono"
                  className={`form-control ${estados.telefono}`}
                  placeholder="Ej: 573001234567 (con indicativo)"
                  pattern="[0-9]+"
                  minLength={7}
                  maxLength={15}
                  required
                  value={valores.telefono}
                  onChange={handleChange}
                />
                <div className="invalid-feedback">
                  Entre 7 y 15 dígitos (puede incluir el indicativo del país).
                </div>
              </div>
            </div>

            <div className="mb-2">
              <label className="form-label fw-semibold" htmlFor="direccion">
                Dirección
              </label>
              <input
                type="text"
                name="direccion"
                id="direccion"
                className={`form-control ${estados.direccion}`}
                placeholder="Dirección de residencia"
                minLength={5}
                required
                value={valores.direccion}
                onChange={handleChange}
              />
              <div className="invalid-feedback">Mínimo 5 caracteres.</div>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-12">
                <label className="form-label fw-semibold" htmlFor="password">
                  Contraseña
                </label>
                <div className="input-group">
                  <input
                    type={verPassword ? "text" : "password"}
                    name="password"
                    id="password"
                    className={`form-control ${estados.password}`}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    value={valores.password}
                    onChange={handleChange}
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
                <div className="invalid-feedback">Mínimo 6 caracteres.</div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-login w-100" disabled={cargando}>
              <i className="bi bi-person-plus me-1"></i> Registrarse
            </button>
          </form>

          <div className="text-center mt-3">
            <Link
              to="/login"
              className="text-decoration-none text-secondary"
              style={{ fontSize: "0.88rem" }}
            >
              ¿Ya tienes cuenta? Inicia sesión
            </Link>
          </div>
          <div className="text-center mt-2 footer-text">© Dotaciones Toronto 2026</div>
        </div>
      </div>
    </>
  );
}

export default Registro;