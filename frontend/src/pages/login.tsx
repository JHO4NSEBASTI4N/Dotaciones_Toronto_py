// src/pages/login.tsx
//
// Pantalla de entrada. Dos columnas: presentación a la izquierda, formulario a
// la derecha (se apila en celular). Si el usuario tiene varios roles, después
// de autenticarse elige con cuál trabajar.

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck, Boxes, Check, Eye, EyeOff, Lock, Mail, Package, ShieldCheck } from "../components/iconos";

import { autenticacion, NOMBRE_ROL, RUTA_POR_ROL } from "../services/autenticacion";
import { ErrorApi } from "../services/api";
import { useSesion } from "../context/sesion-contexto";
import type { RolDisponible } from "../types";

export default function Login() {
  const navegar = useNavigate();
  const { establecerSesion, recargar } = useSesion();

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState<RolDisponible[] | null>(null);

  /** Entra con el correo y contraseña escritos. */
  const entrar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError("");
    setEntrando(true);

    try {
      await autenticacion.login(correo.trim(), password);

      // Si tiene más de un rol, primero pregunta con cuál entrar.
      const disponibles = await autenticacion.misRoles();
      const activos = disponibles.filter((rol) => rol.id_rol > 0);

      if (activos.length > 1) {
        setRoles(activos);
        setEntrando(false);
        return;
      }

      await establecerSesion();
      navegar(autenticacion.rutaDeInicio(), { replace: true });
    } catch (fallo) {
      const mensaje =
        fallo instanceof ErrorApi
          ? fallo.estado === 401
            ? "Correo o contraseña incorrectos."
            : fallo.estado === 403
              ? "Tu usuario no tiene un rol asignado. Pide al administrador que te asigne uno."
              : fallo.message
          : "No se pudo contactar el servidor. Revisa que el backend esté encendido.";
      setError(mensaje);
      setEntrando(false);
    }
  };

  /** Ya autenticado: elige el rol con el que quiere trabajar. */
  const entrarConRol = async (idRol: number) => {
    setEntrando(true);
    setError("");

    try {
      await autenticacion.cambiarRol(idRol);
      await recargar();
      navegar(RUTA_POR_ROL[idRol] ?? "/login", { replace: true });
    } catch (fallo) {
      // Si el backend responde 409 significa que ya estabamos con ese rol:
      // no es un error, el token ya sirve. Se entra directo.
      if (fallo instanceof ErrorApi && fallo.estado === 409) {
        await recargar();
        navegar(RUTA_POR_ROL[idRol] ?? "/login", { replace: true });
        return;
      }
      setError(
        fallo instanceof ErrorApi
          ? `No se pudo cambiar de rol: ${fallo.message}.`
          : "No se pudo cambiar de rol. Revisa que el backend esté encendido."
      );
      setEntrando(false);
    }
  };

  return (
    <div className="login-pagina">
      {/* ---------------- Presentación ---------------- */}
      <section className="login-presentacion">
        <div className="marca">
          <span className="marca-icono">
            <Package size={23} />
          </span>
          Dotaciones <span className="marca-verde">Toronto</span>
        </div>

        <div className="presentacion-contenido">
          <span className="etiqueta">SISTEMA DE GESTIÓN</span>

          <h1>
            Dotaciones
            <br />
            empresariales, en orden.
          </h1>

          <p>
            Catálogo, pedidos, inventario por bodega, ventas y facturación
            electrónica en un solo lugar. Cada rol ve únicamente lo que necesita.
          </p>

          <ul className="presentacion-lista">
            <li>
              <Check size={16} /> Control de stock con alertas de mínimos
            </li>
            <li>
              <Check size={16} /> Pedidos y devoluciones trazables
            </li>
            <li>
              <Check size={16} /> Facturación DIAN simulada y lista para conectar
            </li>
          </ul>
        </div>

        <div className="presentacion-pie">
          <ShieldCheck size={14} />
        </div>
      </section>

      {/* ---------------- Formulario ---------------- */}
      <section className="login-formulario-lado">
        <div className="login-caja">
          {roles ? (
            <>
              <h2>¿Con qué rol entras?</h2>
              <p>
                Tu cuenta tiene varios roles asignados. Elige uno para esta
                sesión; puedes cambiarlo después desde el menú.
              </p>

              <div className="login-formulario">
                {roles.map((rol) => {
                  const Icono =
                    rol.id_rol === 1
                      ? ShieldCheck
                      : rol.id_rol === 4
                        ? Boxes
                        : BadgeCheck;

                  return (
                    <button
                      key={rol.id_rol}
                      type="button"
                      className="boton-principal"
                      style={{ justifyContent: "flex-start" }}
                      disabled={entrando}
                      onClick={() => void entrarConRol(rol.id_rol)}
                    >
                      <Icono size={16} />
                      Entrar como {NOMBRE_ROL[rol.id_rol] ?? rol.nombre_rol}
                      <ArrowRight size={15} style={{ marginLeft: "auto" }} />
                    </button>
                  );
                })}
              </div>

              {error && <p className="mensaje-error" style={{ marginTop: 14 }}>{error}</p>}

              <p className="login-pie">
                <button
                  type="button"
                  className="dt-boton-secundario"
                  onClick={() => {
                    autenticacion.logout();
                    setRoles(null);
                  }}
                >
                  Volver al inicio de sesión
                </button>
              </p>
            </>
          ) : (
            <>
              <h2>Iniciar sesión</h2>
              <p>Ingresa con el correo que te registró la empresa.</p>

              <form className="login-formulario" onSubmit={entrar}>
                <label className="campo">
                  <span>Correo electrónico</span>
                  <div className="campo-caja">
                    <Mail size={16} />
                    <input
                      type="email"
                      value={correo}
                      onChange={(evento) => setCorreo(evento.target.value)}
                      placeholder="tu.correo@empresa.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </label>

                <label className="campo">
                  <span>Contraseña</span>
                  <div className="campo-caja">
                    <Lock size={16} />
                    <input
                      type={verPassword ? "text" : "password"}
                      value={password}
                      onChange={(evento) => setPassword(evento.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="campo-ojo"
                      onClick={() => setVerPassword((previo) => !previo)}
                      aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                {error && (
                  <p className="mensaje-error" role="alert">
                    {error}
                  </p>
                )}

                <button type="submit" className="boton-principal" disabled={entrando}>
                  {entrando ? (
                    <>
                      <span className="dt-spinner" /> Validando…
                    </>
                  ) : (
                    <>
                      Entrar al sistema <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              <p className="login-pie">
                ¿No tienes cuenta?{" "}
                <Link to="/registro" className="dt-boton-secundario">
                  Regístrate aquí
                </Link>
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}