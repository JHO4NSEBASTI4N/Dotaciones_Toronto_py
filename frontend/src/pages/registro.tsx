// src/pages/registro.tsx
//
// registro.html del proyecto Java.
// El backend asigna siempre el rol Cliente en el registro público; después se
// entra por el login.

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  UserRound,
} from "../components/iconos";
import { autenticacion } from "../services/autenticacion";
import { ErrorApi } from "../services/api";

export default function Registro() {
  const navegar = useNavigate();

  const [formulario, setFormulario] = useState({
    nombre: "",
    correo: "",
    documento: "",
    telefono: "",
    direccion: "",
    password: "",
    repetida: "",
  });

  const [verPassword, setVerPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError("");

    if (formulario.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (formulario.password !== formulario.repetida) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }

    setEnviando(true);

    try {
      await autenticacion.registrar({
        nombre: formulario.nombre,
        correo: formulario.correo,
        documento: formulario.documento || null,
        telefono: formulario.telefono || null,
        direccion: formulario.direccion || null,
        password: formulario.password,
      });

      setListo(true);
    } catch (fallo) {
      setError(
        fallo instanceof ErrorApi && fallo.estado === 400
          ? "Ese correo ya está registrado. Prueba iniciando sesión."
          : fallo instanceof Error
            ? fallo.message
            : "No se pudo crear la cuenta."
      );
    } finally {
      setEnviando(false);
    }
  };

  if (listo) {
    return (
      <div className="registro-pagina">
        <div className="registro-tarjeta registro-exito">
          <span className="registro-exito-icono">
            <Check size={30} />
          </span>
          <h1>¡Cuenta creada!</h1>
          <p>
            Ya puedes iniciar sesión con <strong>{formulario.correo}</strong>. Tu
            cuenta entra con el rol de Cliente.
          </p>
          <button
            type="button"
            className="boton-principal"
            onClick={() => navegar("/login", { replace: true })}
          >
            Ir a iniciar sesión <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="registro-pagina">
      <div className="registro-tarjeta">
        <header className="registro-encabezado">
          <div className="marca marca-oscura">
            <span className="marca-icono-solido">
              <Package size={19} />
            </span>
            Dotaciones <span className="marca-verde">Toronto</span>
          </div>

          <h1>Crear cuenta</h1>
          <p>Regístrate como cliente y empieza a pedir tus dotaciones.</p>
        </header>

        <form className="registro-formulario" onSubmit={guardar}>
          <label className="campo">
            <span>Nombre completo *</span>
            <div className="campo-caja">
              <UserRound size={16} />
              <input
                value={formulario.nombre}
                onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })}
                required
              />
            </div>
          </label>

          <label className="campo">
            <span>Correo electrónico *</span>
            <div className="campo-caja">
              <Mail size={16} />
              <input
                type="email"
                value={formulario.correo}
                onChange={(e) => setFormulario({ ...formulario, correo: e.target.value })}
                autoComplete="email"
                required
              />
            </div>
          </label>

          <div className="registro-dos-columnas">
            <label className="campo">
              <span>Documento</span>
              <div className="campo-caja">
                <UserRound size={16} />
                <input
                  value={formulario.documento}
                  onChange={(e) => setFormulario({ ...formulario, documento: e.target.value })}
                />
              </div>
            </label>

            <label className="campo">
              <span>Teléfono</span>
              <div className="campo-caja">
                <Phone size={16} />
                <input
                  value={formulario.telefono}
                  onChange={(e) => setFormulario({ ...formulario, telefono: e.target.value })}
                />
              </div>
            </label>
          </div>

          <label className="campo">
            <span>Dirección de entrega</span>
            <div className="campo-caja">
              <MapPin size={16} />
              <input
                value={formulario.direccion}
                onChange={(e) => setFormulario({ ...formulario, direccion: e.target.value })}
              />
            </div>
          </label>

          <div className="registro-dos-columnas">
            <label className="campo">
              <span>Contraseña *</span>
              <div className="campo-caja">
                <Lock size={16} />
                <input
                  type={verPassword ? "text" : "password"}
                  minLength={8}
                  value={formulario.password}
                  onChange={(e) => setFormulario({ ...formulario, password: e.target.value })}
                  autoComplete="new-password"
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

            <label className="campo">
              <span>Repetir contraseña *</span>
              <div className="campo-caja">
                <Lock size={16} />
                <input
                  type={verPassword ? "text" : "password"}
                  value={formulario.repetida}
                  onChange={(e) => setFormulario({ ...formulario, repetida: e.target.value })}
                  autoComplete="new-password"
                  required
                />
              </div>
            </label>
          </div>

          {error && (
            <p className="mensaje-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="boton-principal" disabled={enviando}>
            {enviando ? (
              <>
                <span className="dt-spinner" /> Creando cuenta…
              </>
            ) : (
              <>
                Crear cuenta <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <footer className="registro-pie">
          <Link to="/login" className="dt-boton-secundario">
            <ArrowLeft size={13} /> Ya tengo cuenta
          </Link>
          <span>
            <ShieldCheck size={13} /> Tus datos quedan protegidos
          </span>
        </footer>
      </div>
    </div>
  );
}
