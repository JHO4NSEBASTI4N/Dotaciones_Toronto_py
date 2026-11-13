// src/pages/registro.tsx
//
// Registro público de clientes. Mismo estilo compacto que el login.

import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "../components/iconos";
import { ErrorApi } from "../services/api";
import { autenticacion } from "../services/autenticacion";

const NOMBRE_MAX = 60;
const DOCUMENTO_MIN = 6;
const DOCUMENTO_MAX = 12;
const TELEFONO_MIN = 7;
const TELEFONO_MAX = 10;
const PASSWORD_MIN = 8;

const SOLO_LETRAS_Y_ESPACIOS = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü ]+$/;
const NO_PERMITIDO_EN_NOMBRE = /[^A-Za-zÁÉÍÓÚáéíóúÑñÜü ]/g;
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIENE_LETRA = /[A-Za-zÁÉÍÓÚáéíóúÑñÜü]/;
const TIENE_NUMERO = /\d/;
const TIENE_ESPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/;

type Campo = "nombre" | "correo" | "documento" | "telefono" | "direccion" | "password" | "repetida";
type Formulario = Record<Campo, string>;

const FORMULARIO_VACIO: Formulario = {
  nombre: "",
  correo: "",
  documento: "",
  telefono: "",
  direccion: "",
  password: "",
  repetida: "",
};

/* =========================================================
   VALIDACIONES
========================================================= */

function validarNombre(valor: string): string | null {
  const limpio = valor.trim();
  if (!limpio) return "El nombre es obligatorio.";
  if (!SOLO_LETRAS_Y_ESPACIOS.test(limpio)) return "Solo puede tener letras y espacios.";
  if (limpio.length > NOMBRE_MAX) return `Máximo ${NOMBRE_MAX} caracteres.`;
  return null;
}

function validarCorreo(valor: string): string | null {
  if (!valor.trim()) return "El correo es obligatorio.";
  if (!CORREO_VALIDO.test(valor.trim())) return "Escribe un correo válido.";
  return null;
}

function validarDocumento(valor: string): string | null {
  if (!valor) return null;
  if (!/^\d+$/.test(valor)) return "Solo puede tener números.";
  if (valor.length < DOCUMENTO_MIN || valor.length > DOCUMENTO_MAX) {
    return `Debe tener entre ${DOCUMENTO_MIN} y ${DOCUMENTO_MAX} dígitos.`;
  }
  return null;
}

function validarTelefono(valor: string): string | null {
  if (!valor) return null;
  if (!/^\d+$/.test(valor)) return "Solo puede tener números.";
  if (valor.length < TELEFONO_MIN || valor.length > TELEFONO_MAX) {
    return `Debe tener entre ${TELEFONO_MIN} y ${TELEFONO_MAX} dígitos.`;
  }
  return null;
}

function requisitosPassword(valor: string) {
  return [
    { texto: `Mínimo ${PASSWORD_MIN} caracteres`, cumple: valor.length >= PASSWORD_MIN },
    { texto: "Una letra", cumple: TIENE_LETRA.test(valor) },
    { texto: "Un número", cumple: TIENE_NUMERO.test(valor) },
    { texto: "Un carácter especial", cumple: TIENE_ESPECIAL.test(valor) },
  ];
}

function validarPassword(valor: string): string | null {
  if (!valor) return "La contraseña es obligatoria.";
  const pendiente = requisitosPassword(valor).find((requisito) => !requisito.cumple);
  return pendiente ? `Falta: ${pendiente.texto.toLowerCase()}.` : null;
}

function validarRepetida(valor: string, password: string): string | null {
  if (!valor) return "Repite la contraseña.";
  if (valor !== password) return "Las contraseñas no coinciden.";
  return null;
}

/* =========================================================
   CAMPO REUTILIZABLE
========================================================= */

interface CampoProps {
  id: string;
  etiqueta: string;
  icono: typeof Mail;
  error?: string;
  requerido?: boolean;
  children: ReactNode;
}

function Campo({ id, etiqueta, icono: Icono, error, requerido, children }: CampoProps) {
  return (
    <div className={`registro-campo ${error ? "registro-campo-invalido" : ""}`}>
      <label htmlFor={id} className="registro-etiqueta">
        {etiqueta}
        {requerido ? " *" : ""}
      </label>
      <div className="registro-entrada">
        <span className="registro-icono">
          <Icono size={16} />
        </span>
        {children}
      </div>
      {error && <small className="registro-error">{error}</small>}
    </div>
  );
}

/* =========================================================
   PÁGINA
========================================================= */

export default function Registro() {
  const [formulario, setFormulario] = useState<Formulario>(FORMULARIO_VACIO);
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
  const [verPassword, setVerPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensajeError, setMensajeError] = useState("");
  const [listo, setListo] = useState(false);

  const requisitos = requisitosPassword(formulario.password);

  function cambiar(campo: Campo, valor: string) {
    let limpio = valor;

    if (campo === "documento") limpio = valor.replace(/\D/g, "").slice(0, DOCUMENTO_MAX);
    if (campo === "telefono") limpio = valor.replace(/\D/g, "").slice(0, TELEFONO_MAX);
    if (campo === "nombre") limpio = valor.replace(NO_PERMITIDO_EN_NOMBRE, "").slice(0, NOMBRE_MAX);

    setFormulario((anterior) => ({ ...anterior, [campo]: limpio }));
    setErrores((anterior) => ({ ...anterior, [campo]: undefined }));
    setMensajeError("");
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const f = formulario;

    const nuevosErrores: Partial<Record<Campo, string>> = {
      nombre: validarNombre(f.nombre) ?? undefined,
      correo: validarCorreo(f.correo) ?? undefined,
      documento: validarDocumento(f.documento) ?? undefined,
      telefono: validarTelefono(f.telefono) ?? undefined,
      password: validarPassword(f.password) ?? undefined,
      repetida: validarRepetida(f.repetida, f.password) ?? undefined,
    };

    if (Object.values(nuevosErrores).some(Boolean)) {
      setErrores(nuevosErrores);
      return;
    }

    setErrores({});
    setEnviando(true);

    try {
      await autenticacion.registrar({
        nombre: f.nombre.trim(),
        correo: f.correo.trim(),
        documento: f.documento || null,
        telefono: f.telefono || null,
        direccion: f.direccion.trim() || null,
        password: f.password,
      });
      setListo(true);
    } catch (error) {
      if (error instanceof ErrorApi && error.estado === 400) {
        setMensajeError("Ese correo ya está registrado. Prueba iniciando sesión.");
      } else {
        setMensajeError(
          error instanceof Error ? error.message : "No se pudo crear la cuenta. Intenta de nuevo."
        );
      }
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <main className="registro-pagina">
        <section className="registro-tarjeta registro-exito">
          <span className="registro-exito-icono">
            <Check size={26} />
          </span>
          <h1>Cuenta creada</h1>
          <p>Ya puedes iniciar sesión con tu correo y contraseña.</p>
          <Link to="/login" className="registro-boton">
            Ir a iniciar sesión <ArrowRight size={15} />
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="registro-pagina">
      <section className="registro-tarjeta">
        <h1>Crear cuenta</h1>
        <p className="registro-sub">Regístrate como cliente y empieza a pedir tus dotaciones.</p>

        <form className="registro-form" onSubmit={guardar} noValidate>
          <Campo id="nombre" etiqueta="Nombre completo" icono={UserRound} requerido error={errores.nombre}>
            <input
              id="nombre"
              name="nombre"
              type="text"
              placeholder="Tu nombre y apellido"
              value={formulario.nombre}
              onChange={(e) => cambiar("nombre", e.target.value)}
              autoComplete="name"
            />
          </Campo>

          <Campo id="correo" etiqueta="Correo electrónico" icono={Mail} requerido error={errores.correo}>
            <input
              id="correo"
              name="correo"
              type="email"
              placeholder="tucorreo@empresa.com"
              value={formulario.correo}
              onChange={(e) => cambiar("correo", e.target.value)}
              autoComplete="email"
            />
          </Campo>

          <div className="registro-fila">
            <Campo id="documento" etiqueta="Documento" icono={UserRound} error={errores.documento}>
              <input
                id="documento"
                name="documento"
                type="text"
                inputMode="numeric"
                placeholder="Solo números"
                value={formulario.documento}
                onChange={(e) => cambiar("documento", e.target.value)}
              />
            </Campo>

            <Campo id="telefono" etiqueta="Teléfono" icono={Phone} error={errores.telefono}>
              <input
                id="telefono"
                name="telefono"
                type="tel"
                inputMode="numeric"
                placeholder="Solo números"
                value={formulario.telefono}
                onChange={(e) => cambiar("telefono", e.target.value)}
                autoComplete="tel"
              />
            </Campo>
          </div>

          <Campo id="direccion" etiqueta="Dirección de entrega" icono={MapPin}>
            <input
              id="direccion"
              name="direccion"
              type="text"
              placeholder="Calle, carrera, barrio"
              value={formulario.direccion}
              onChange={(e) => cambiar("direccion", e.target.value)}
              autoComplete="street-address"
            />
          </Campo>

          <div className="registro-fila">
            <Campo id="password" etiqueta="Contraseña" icono={Lock} requerido error={errores.password}>
              <input
                id="password"
                name="password"
                type={verPassword ? "text" : "password"}
                className="registro-con-ojo"
                placeholder="••••••••"
                value={formulario.password}
                onChange={(e) => cambiar("password", e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="registro-ojo"
                onClick={() => setVerPassword((anterior) => !anterior)}
                aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </Campo>

            <Campo id="repetida" etiqueta="Repetir contraseña" icono={Lock} requerido error={errores.repetida}>
              <input
                id="repetida"
                name="repetida"
                type={verPassword ? "text" : "password"}
                placeholder="••••••••"
                value={formulario.repetida}
                onChange={(e) => cambiar("repetida", e.target.value)}
                autoComplete="new-password"
              />
            </Campo>
          </div>

          <ul className="registro-requisitos">
            {requisitos.map((requisito) => (
              <li key={requisito.texto} className={requisito.cumple ? "ok" : ""}>
                {requisito.cumple ? <Check size={12} /> : <span className="registro-punto" />}
                {requisito.texto}
              </li>
            ))}
          </ul>

          {mensajeError && <p className="registro-alerta">{mensajeError}</p>}

          <button type="submit" className="registro-boton" disabled={enviando}>
            {enviando ? (
              "Creando cuenta…"
            ) : (
              <>
                Crear cuenta <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        <div className="registro-pie">
          <span>¿Ya tienes cuenta?</span>
          <Link to="/login" className="registro-enlace">
            Inicia sesión
          </Link>
        </div>
      </section>
    </main>
  );
}