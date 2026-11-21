// src/pages/login.tsx
//
// Pantalla de entrada. Dos columnas: presentación a la izquierda, formulario a
// la derecha (se apila en celular). Si el usuario tiene varios roles, después
// de autenticarse elige con cuál trabajar.

import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Boxes,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Package,
  ShieldCheck,
} from "../components/iconos";

import { autenticacion, NOMBRE_ROL, RUTA_POR_ROL } from "../services/autenticacion";
import { ErrorApi } from "../services/api";
import { hayCarritoPortadaPendiente } from "../services/carrito-portada";
import { useSesion } from "../context/sesion-contexto";
import type { RolDisponible } from "../types";

function rutaTrasLogin(
  idRol: number,
  rutaPredeterminada = RUTA_POR_ROL[idRol] ?? "/login"
): string {
  if (idRol === 2 && hayCarritoPortadaPendiente()) return "/cliente/carrito";
  return rutaPredeterminada;
}

interface EstadoRutaLogin {
  avisoAcceso?: string;
}

const DURACION_AVISO_ACCESO_MS = 5000;

const MENSAJE_POR_CODIGO: Record<string, string> = {
  admin: "Debes iniciar sesión para ingresar al panel de Administrador.",
  cliente: "Debes iniciar sesión para ingresar al panel de Cliente.",
  vendedor: "Debes iniciar sesión para ingresar al panel de Vendedor.",
  bodeguero: "Debes iniciar sesión para ingresar al panel de Bodeguero.",
  rol: "Debes iniciar sesión para seleccionar un rol.",
  panel: "Debes iniciar sesión para ingresar a esta sección.",
};

function obtenerAvisoDesdeRuta(
  estado: EstadoRutaLogin | null,
  search: string
): string {
  if (estado?.avisoAcceso) return estado.avisoAcceso;
  const codigo = new URLSearchParams(search).get("denegado");
  if (!codigo) return "";
  return MENSAJE_POR_CODIGO[codigo] ?? MENSAJE_POR_CODIGO.panel;
}

export default function Login() {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const { establecerSesion, recargar } = useSesion();

  const mensajeInicial = obtenerAvisoDesdeRuta(
    (ubicacion.state as EstadoRutaLogin | null) ?? null,
    ubicacion.search
  );

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState("");
  const [avisoAcceso, setAvisoAcceso] = useState<string>(mensajeInicial);
  const [claveRutaVista, setClaveRutaVista] = useState(ubicacion.key);
  const [roles, setRoles] = useState<RolDisponible[] | null>(null);

  // Si se vuelve a redirigir a /login desde otra ruta protegida, reactiva el aviso.
  if (ubicacion.key !== claveRutaVista) {
    setClaveRutaVista(ubicacion.key);
    if (mensajeInicial) {
      setAvisoAcceso(mensajeInicial);
    }
  }

  // Oculta automáticamente el aviso de "Acceso denegado" a los 5 segundos y
  // limpia la URL/historial para que no reaparezca al recargar la página (F5).
  useEffect(() => {
    if (!avisoAcceso) return;

    const parametros = new URLSearchParams(window.location.search);
    const teniaDenegado = parametros.has("denegado");
    const teniaEstado = Boolean(window.history.state?.usr?.avisoAcceso);

    if (teniaDenegado || teniaEstado) {
      parametros.delete("denegado");
      const nuevaQuery = parametros.toString();
      const nuevaUrl = `${window.location.pathname}${nuevaQuery ? `?${nuevaQuery}` : ""}${window.location.hash}`;
      window.history.replaceState(
        { ...(window.history.state ?? {}), usr: null },
        "",
        nuevaUrl
      );
    }

    const temporizador = window.setTimeout(() => {
      setAvisoAcceso("");
    }, DURACION_AVISO_ACCESO_MS);

    return () => window.clearTimeout(temporizador);
  }, [avisoAcceso, claveRutaVista]);

  /** Entra con el correo y contraseña escritos. */
  const entrar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError("");
    setAvisoAcceso("");
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
      const idRolActivo = autenticacion.rolActual()?.id_rol ?? 0;
      navegar(rutaTrasLogin(idRolActivo, autenticacion.rutaDeInicio()), { replace: true });
    } catch (fallo) {
      const mensaje =
        fallo instanceof ErrorApi
          ? fallo.estado === 401
            ? "Correo o contraseña incorrectos."
            : fallo.estado === 403
              ? (fallo.message ||
                  "Tu usuario no tiene un rol asignado. Pide al administrador que te asigne uno.")
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
      navegar(rutaTrasLogin(idRol), { replace: true });
    } catch (fallo) {
      // Si el backend responde 409 significa que ya estabamos con ese rol:
      // no es un error, el token ya sirve. Se entra directo.
      if (fallo instanceof ErrorApi && fallo.estado === 409) {
        await recargar();
        navegar(rutaTrasLogin(idRol), { replace: true });
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
        <div className="login-formulario-contenido">
          <Link to="/" className="auth-volver-inicio">
            <ArrowLeft size={16} />
            Volver a la página principal
          </Link>
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
                {avisoAcceso && (
                  <div
                    className="mensaje-error aviso-acceso-denegado"
                    role="alert"
                    aria-live="assertive"
                  >
                    <span
                      className="aviso-acceso-denegado-icono"
                      aria-hidden="true"
                    >
                      <AlertTriangle size={18} />
                    </span>
                    <div className="aviso-acceso-denegado-texto">
                      <strong>Acceso denegado</strong>
                      <span>{avisoAcceso}</span>
                    </div>
                    <button
                      type="button"
                      className="aviso-acceso-denegado-cerrar"
                      onClick={() => setAvisoAcceso("")}
                      aria-label="Cerrar aviso"
                    >
                      ×
                    </button>
                    <span
                      className="aviso-acceso-denegado-barra"
                      aria-hidden="true"
                    />
                  </div>
                )}

                <h2>Iniciar sesión</h2>
                <p>Ingresa con el correo que te registró la empresa.</p>
                {new URLSearchParams(ubicacion.search).get("recuperada") === "1" && <p role="status" style={{ color: "#16805b" }}>Contraseña actualizada. Ya puedes iniciar sesión.</p>}

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

                  <Link to="/recuperar-password" style={{ textAlign: "right" }}>¿Olvidaste tu contraseña?</Link>

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
        </div>
      </section>
    </div>
  );
}