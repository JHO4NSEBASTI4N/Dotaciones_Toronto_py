// src/pages/registro.tsx
//
// Registro público de clientes. Mismo estilo compacto que el login.

import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
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
import { validarTelefono } from "../utils/validaciones";
import "../assets/style/validacion-registro.css";

const NOMBRE_MIN = 2;
const NOMBRE_MAX = 60;
const DIRECCION_MAX = 255;
const CORREO_MAX = 254;
const PASSWORD_MAX_BYTES = 72;
const DOCUMENTO_MIN = 6;
const DOCUMENTO_MAX = 12;
const TELEFONO_MAX_CARACTERES = 32;
const PASSWORD_MIN = 8;

const SOLO_LETRAS_Y_ESPACIOS = /^[\p{L}\p{M}]+(?:[ '\u2019.-][\p{L}\p{M}]+)*$/u;
const CORREO_VALIDO = /^[^\s@]+@(?:[^\s@.]+\.)+[^\s@.]+$/;
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
  if (limpio.length < NOMBRE_MIN) return `Debe tener al menos ${NOMBRE_MIN} letras.`;
  if (!SOLO_LETRAS_Y_ESPACIOS.test(limpio)) return "Solo puede tener letras y espacios.";
  if (limpio.length > NOMBRE_MAX) return `Máximo ${NOMBRE_MAX} caracteres.`;
  return null;
}

function validarCorreo(valor: string): string | null {
  if (!valor.trim()) return "El correo es obligatorio.";
  if (Array.from(valor.trim()).length > CORREO_MAX) return `Máximo ${CORREO_MAX} caracteres.`;
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

function validarDireccion(valor: string): string | null {
  if (Array.from(valor.trim()).length > DIRECCION_MAX) return `Máximo ${DIRECCION_MAX} caracteres.`;
  return null;
}

function requisitosPassword(valor: string) {
  return [
    { texto: `Mínimo ${PASSWORD_MIN} caracteres`, cumple: Array.from(valor).length >= PASSWORD_MIN },
    { texto: "Una letra", cumple: TIENE_LETRA.test(valor) },
    { texto: "Un número", cumple: TIENE_NUMERO.test(valor) },
    { texto: "Un carácter especial", cumple: TIENE_ESPECIAL.test(valor) },
    { texto: `Máximo ${PASSWORD_MAX_BYTES} bytes`, cumple: valor.length > 0 && new TextEncoder().encode(valor).length <= PASSWORD_MAX_BYTES },
  ];
}

function validarPassword(valor: string): string | null {
  if (!valor) return "La contraseña es obligatoria.";
  if (new TextEncoder().encode(valor).length > PASSWORD_MAX_BYTES) return `La contraseña supera el máximo de ${PASSWORD_MAX_BYTES} bytes.`;
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
  id: Campo;
  etiqueta: string;
  icono: typeof Mail;
  ayuda: string;
  error?: string;
  tocado: boolean;
  valor: string;
  requerido?: boolean;
  children: ReactNode;
}

function Campo({ id, etiqueta, icono: Icono, ayuda, error, tocado, valor, requerido, children }: CampoProps) {
  const mostrarError = tocado && Boolean(error);
  const mostrarValido = tocado && !error && valor.trim().length > 0;
  const mensaje = mostrarError ? error : mostrarValido
    ? (id === "correo" ? "Formato válido. Se comprobará al registrar." : "Correcto")
    : tocado && !requerido ? "Opcional: puedes dejarlo vacío." : "";

  return (
    <div className={`registro-campo ${mostrarError ? "registro-campo-invalido" : mostrarValido ? "registro-campo-valido" : ""}`}>
      <label htmlFor={id} className="registro-etiqueta">
        {etiqueta}{requerido ? " *" : <span className="registro-opcional"> (opcional)</span>}
      </label>
      <div className="registro-entrada">
        <span className="registro-icono"><Icono size={16} /></span>
        {children}
      </div>
      <small id={`${id}-ayuda`} className="registro-ayuda">{ayuda}</small>
      <small id={`${id}-estado`} className={mostrarError ? "registro-error" : "registro-validacion-correcta"} aria-live="polite">
        {mensaje}
      </small>
    </div>
  );
}

/* =========================================================
   PÁGINA
========================================================= */

export default function Registro() {
  const [formulario, setFormulario] = useState<Formulario>(FORMULARIO_VACIO);
  const [tocados, setTocados] = useState<Partial<Record<Campo, boolean>>>({});
  const [verPassword, setVerPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensajeError, setMensajeError] = useState("");
  const [listo, setListo] = useState(false);

  const requisitos = requisitosPassword(formulario.password);
  const errores: Partial<Record<Campo, string>> = {
    nombre: validarNombre(formulario.nombre) ?? undefined,
    correo: validarCorreo(formulario.correo) ?? undefined,
    documento: validarDocumento(formulario.documento) ?? undefined,
    telefono: validarTelefono(formulario.telefono) ?? undefined,
    direccion: validarDireccion(formulario.direccion) ?? undefined,
    password: validarPassword(formulario.password) ?? undefined,
    repetida: validarRepetida(formulario.repetida, formulario.password) ?? undefined,
  };

  function cambiar(campo: Campo, valor: string) {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
    setTocados((anterior) => ({ ...anterior, [campo]: true }));
    setMensajeError("");
  }

  function atributosCampo(campo: Campo) {
    return {
      "aria-invalid": Boolean(tocados[campo] && errores[campo]),
      "aria-describedby": `${campo}-ayuda ${campo}-estado${campo === "password" ? " password-requisitos" : ""}`,
      onBlur: () => setTocados((anterior) => ({ ...anterior, [campo]: true })),
    };
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const f = formulario;

    setTocados({ nombre: true, correo: true, documento: true, telefono: true, direccion: true, password: true, repetida: true });
    if (Object.values(errores).some(Boolean)) return;

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
      if (error instanceof ErrorApi && error.estado === 409) {
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
        <div className="registro-contenido">
          <Link to="/" className="auth-volver-inicio">
            <ArrowLeft size={16} />
            Volver a la página principal
          </Link>
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
        </div>
      </main>
    );
  }

  return (
    <main className="registro-pagina">
      <div className="registro-contenido">
        <Link to="/" className="auth-volver-inicio">
          <ArrowLeft size={16} />
          Volver a la página principal
        </Link>
        <section className="registro-tarjeta">
          <h1>Crear cuenta</h1>
          <p className="registro-sub">Regístrate como cliente y empieza a pedir tus dotaciones.</p>

          <form className="registro-form" onSubmit={guardar} noValidate>
            <Campo id="nombre" etiqueta="Nombre completo" icono={UserRound} ayuda="Usa entre 2 y 60 letras y espacios." requerido error={errores.nombre} tocado={!!tocados.nombre} valor={formulario.nombre}>
              <input
                id="nombre"
                {...atributosCampo("nombre")}
                name="nombre"
                type="text"
                minLength={NOMBRE_MIN}
                maxLength={NOMBRE_MAX}
                placeholder="Tu nombre y apellido"
                value={formulario.nombre}
                onChange={(e) => cambiar("nombre", e.target.value)}
                autoComplete="name"
              />
            </Campo>

            <Campo id="correo" etiqueta="Correo electrónico" icono={Mail} ayuda="Escribe un correo al que tengas acceso." requerido error={errores.correo} tocado={!!tocados.correo} valor={formulario.correo}>
              <input
                id="correo"
                {...atributosCampo("correo")}
                name="correo"
                type="email"
                maxLength={CORREO_MAX}
                placeholder="tucorreo@empresa.com"
                value={formulario.correo}
                onChange={(e) => cambiar("correo", e.target.value)}
                autoComplete="email"
              />
            </Campo>

            <div className="registro-fila">
              <Campo id="documento" etiqueta="Documento" icono={UserRound} ayuda="Solo números; entre 6 y 12 dígitos." error={errores.documento} tocado={!!tocados.documento} valor={formulario.documento}>
                <input
                  id="documento"
                  {...atributosCampo("documento")}
                  name="documento"
                  type="text"
                  inputMode="numeric"
                  maxLength={DOCUMENTO_MAX}
                  placeholder="Solo números"
                  value={formulario.documento}
                  onChange={(e) => cambiar("documento", e.target.value)}
                />
              </Campo>

              <Campo id="telefono" etiqueta="Teléfono" icono={Phone} ayuda="Admite código de país (+), espacios, paréntesis y guiones; máximo 15 dígitos." error={errores.telefono} tocado={!!tocados.telefono} valor={formulario.telefono}>
                <input
                  id="telefono"
                  {...atributosCampo("telefono")}
                  name="telefono"
                  type="tel"
                  inputMode="tel"
                  maxLength={TELEFONO_MAX_CARACTERES}
                  placeholder="Ej. +57 (300) 123 4567"
                  value={formulario.telefono}
                  onChange={(e) => cambiar("telefono", e.target.value)}
                  autoComplete="tel"
                />
              </Campo>
            </div>

            <Campo id="direccion" etiqueta="Dirección de entrega" icono={MapPin} ayuda="Hasta 255 caracteres." error={errores.direccion} tocado={!!tocados.direccion} valor={formulario.direccion}>
              <input
                id="direccion"
                {...atributosCampo("direccion")}
                name="direccion"
                type="text"
                maxLength={DIRECCION_MAX}
                placeholder="Calle, carrera, barrio"
                value={formulario.direccion}
                onChange={(e) => cambiar("direccion", e.target.value)}
                autoComplete="street-address"
              />
            </Campo>

            <div className="registro-fila">
              <Campo id="password" etiqueta="Contraseña" icono={Lock} ayuda="Crea una contraseña que cumpla los requisitos." requerido error={errores.password} tocado={!!tocados.password} valor={formulario.password}>
                <input
                  id="password"
                  {...atributosCampo("password")}
                  name="password"
                  type={verPassword ? "text" : "password"}
                  minLength={PASSWORD_MIN}
                  maxLength={PASSWORD_MAX_BYTES}
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

              <Campo id="repetida" etiqueta="Repetir contraseña" icono={Lock} ayuda="Debe coincidir con la contraseña anterior." requerido error={errores.repetida} tocado={!!tocados.repetida} valor={formulario.repetida}>
                <input
                  id="repetida"
                  {...atributosCampo("repetida")}
                  name="repetida"
                  type={verPassword ? "text" : "password"}
                  minLength={PASSWORD_MIN}
                  maxLength={PASSWORD_MAX_BYTES}
                  placeholder="••••••••"
                  value={formulario.repetida}
                  onChange={(e) => cambiar("repetida", e.target.value)}
                  autoComplete="new-password"
                />
              </Campo>
            </div>

            <ul className="registro-requisitos" id="password-requisitos" aria-label="Requisitos de contraseña">
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
      </div>
    </main>
  );
}