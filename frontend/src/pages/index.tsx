// src/pages/index.tsx
//
// index.html del proyecto Java: la portada pública.
// Muestra qué hace el sistema, cómo funciona, contacto y pie de página.

import { useState, type ChangeEvent, type CSSProperties, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight,
  Boxes,
  Check,
  CreditCard,
  Package,
  ShoppingCart,
  Store,
} from "../components/iconos";
import { useSesion } from "../context/sesion-contexto";

/* 🖼️ Fondo de la portada.
   Archivo real: src/assets/images/fondo index.jpg */
import fondoIndex from "../assets/images/fondo index.jpg";

const ESTILO_PORTADA: CSSProperties = {
  backgroundImage: `linear-gradient(rgba(10, 16, 28, 0.62), rgba(10, 16, 28, 0.62)), url("${fondoIndex}")`,
  backgroundSize: "cover",
  backgroundPosition: "center center",
  backgroundRepeat: "no-repeat",
};

const ESTILO_BARRA: CSSProperties = {
  background: "rgba(10, 16, 28, 0.55)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.18)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  height: 64,
  padding: "0 28px",
  alignItems: "center",
};

const ESTILO_MARCA_CLARA: CSSProperties = {
  color: "#ffffff",
  textShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
};

const TEXTO_CLARO: CSSProperties = {
  color: "#ffffff",
  textShadow: "0 2px 8px rgba(0, 0, 0, 0.65), 0 1px 2px rgba(0, 0, 0, 0.4)",
};

/* Botones superiores: más pequeños y alineados */
const ESTILO_BOTON_FANTASMA: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  fontSize: 12.5,
  lineHeight: 1.2,
  borderRadius: 8,
  color: "#ffffff",
  borderColor: "rgba(255, 255, 255, 0.6)",
  background: "rgba(255, 255, 255, 0.14)",
  backdropFilter: "blur(4px)",
};

const ESTILO_BOTON_NARANJA: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  fontSize: 12.5,
  lineHeight: 1.2,
  borderRadius: 8,
  color: "#ffffff",
  background: "linear-gradient(135deg, #fa813b, #e06a28)",
  border: "1px solid transparent",
  boxShadow: "0 6px 16px rgba(250, 129, 59, 0.35)",
};

/* Rejilla común para las secciones de contenido */
const ESTILO_SECCION: CSSProperties = {
  width: "100%",
  maxWidth: 1120,
  margin: "0 auto",
  padding: "0 28px 20px",
  display: "grid",
  gap: 16,
  alignItems: "stretch",
};

const ESTILO_TARJETA_BLANCA: CSSProperties = {
  background: "#ffffff",
  borderRadius: 14,
  boxShadow: "0 14px 32px rgba(0, 0, 0, 0.22)",
};

/* ------------------------------------------------------------------
   Sección de contacto: panel oscuro con acentos naranja (combina con
   la portada). Todo inline para no depender del index.css.
------------------------------------------------------------------ */
const ESTILO_CONTACTO_SECCION: CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
  padding: "0 26px 96px", // ← más separación de la parte de abajo
  background: "transparent",
  border: "none",
  boxShadow: "none",
};

const ESTILO_CONTACTO_PANEL: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1.05fr",
  alignItems: "stretch",
  margin: 0,
  padding: 0,
  gap: 0,
  borderRadius: 26,
  overflow: "hidden",
  background: "linear-gradient(135deg, #1a1a2e 0%, #16213a 45%, #0f3460 100%)",
  boxShadow: "0 26px 60px rgba(0, 0, 0, 0.38)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
};

const ESTILO_CONTACTO_INFO: CSSProperties = {
  position: "relative",
  margin: 0,
  borderRadius: 0,
  padding: "36px 32px",
  color: "#ffffff",
  backgroundImage:
    "radial-gradient(560px 300px at 8% 0%, rgba(250, 129, 59, 0.28), transparent 62%)," +
    "radial-gradient(420px 300px at 100% 100%, rgba(255, 193, 69, 0.16), transparent 60%)",
};

const ESTILO_CONTACTO_TITULO: CSSProperties = {
  marginTop: 12,
  color: "#ffffff",
  fontFamily: '"Big Shoulders Display", "Inter", sans-serif',
  fontSize: 32,
  fontWeight: 800,
  letterSpacing: 0.4,
  lineHeight: 1,
  textTransform: "uppercase",
};

const ESTILO_CONTACTO_LEAD: CSSProperties = {
  margin: "10px 0 16px",
  color: "rgba(255, 255, 255, 0.82)",
  fontSize: 13,
  lineHeight: 1.6,
};

const ESTILO_CONTACTO_ITEM: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: "9px 0",
  borderTop: "1px solid rgba(255, 255, 255, 0.12)",
  color: "#ffffff",
  fontSize: 12.5,
  lineHeight: 1.5,
};

const ESTILO_CONTACTO_ICONO: CSSProperties = {
  flex: "none",
  display: "grid",
  placeItems: "center",
  width: 26,
  height: 26,
  borderRadius: 8,
  color: "#16213a",
  background: "#ffc145",
  fontSize: 13,
};

const ESTILO_FORM_CONTACTO: CSSProperties = {
  margin: 0,
  borderRadius: 0,
  boxShadow: "none",
  padding: "36px 32px",
  background: "#ffffff",
};

const BENEFICIOS = [
  {
    Icono: Store,
    titulo: "Catálogo de dotaciones",
    detalle: "Camisas, pantalones, calzado y seguridad con talla y color.",
  },
  {
    Icono: ShoppingCart,
    titulo: "Pedidos en línea",
    detalle: "El cliente arma su pedido y lo sigue hasta la entrega.",
  },
  {
    Icono: Boxes,
    titulo: "Inventario por bodega",
    detalle: "Entradas, salidas y alertas cuando baja del mínimo.",
  },
  {
    Icono: CreditCard,
    titulo: "Ventas y facturación",
    detalle: "Cada pedido entregado genera su venta y su factura.",
  },
];

const PASOS = [
  { numero: "1", titulo: "Regístrate", detalle: "Creas tu cuenta como cliente." },
  { numero: "2", titulo: "Pide", detalle: "Eliges dotaciones del catálogo." },
  { numero: "3", titulo: "Recibe", detalle: "Bodega despacha y tú confirmas." },
];

const FORMULARIO_CONTACTO_INICIAL = {
  nombre: "",
  correo: "",
  mensaje: "",
};

export default function Portada() {
  const { usuario, cargando } = useSesion();
  const [contacto, setContacto] = useState(FORMULARIO_CONTACTO_INICIAL);
  const [enviado, setEnviado] = useState(false);

  function cambiarContacto(evento: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = evento.target;
    setContacto((anterior) => ({ ...anterior, [name]: value }));
  }

  function enviarContacto(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    // Cuando exista el endpoint de contacto en el backend, la llamada va aquí.
    setContacto(FORMULARIO_CONTACTO_INICIAL);
    setEnviado(true);
  }

  if (cargando) {
    return (
      <div className="dt-pantalla-carga">
        <span className="dt-spinner dt-spinner-grande" />
        <span>Cargando…</span>
      </div>
    );
  }

  // Si ya inició sesión, no tiene sentido mostrarle la portada.
  if (usuario) {
    return (
      <Navigate
        to={
          { 1: "/admin/panel", 2: "/cliente/panel", 3: "/vendedor/panel", 4: "/bodeguero/panel" }[
            usuario.id_rol
          ] ?? "/login"
        }
        replace
      />
    );
  }

  return (
    <div className="portada" style={ESTILO_PORTADA}>
      <header className="portada-barra" style={ESTILO_BARRA}>
        <div className="marca marca-oscura" style={ESTILO_MARCA_CLARA}>
          <span className="marca-icono-solido">
            <Package size={18} />
          </span>
          Dotaciones <span className="marca-verde">Toronto</span>
        </div>

        <nav className="portada-barra-acciones" style={{ alignItems: "center", gap: 8 }}>
          <Link to="/login" className="dt-boton-secundario" style={ESTILO_BOTON_FANTASMA}>
            Iniciar sesión
          </Link>
          <Link to="/registro" className="dt-accion-principal" style={ESTILO_BOTON_NARANJA}>
            Crear cuenta <ArrowRight size={13} />
          </Link>
        </nav>
      </header>

      {/* ---------------------------------------------------------- Héroe */}
      <section className="portada-heroe" style={{ maxWidth: 1120, padding: "54px 28px 44px" }}>
        <span
          className="etiqueta"
          style={{
            color: "#ffffff",
            borderColor: "rgba(255, 255, 255, 0.5)",
            background: "rgba(10, 16, 28, 0.55)",
            fontSize: 10,
            letterSpacing: 1.2,
          }}
        >
          DOTACIONES EMPRESARIALES
        </span>

        <h1 style={{ ...TEXTO_CLARO, fontSize: "clamp(30px, 3.6vw, 52px)", maxWidth: "20ch" }}>
          Toda la dotación de tu empresa,
          <br />
          pedida y controlada en un solo lugar.
        </h1>

        <p style={{ ...TEXTO_CLARO, fontWeight: 500, fontSize: 14.5, maxWidth: "56ch" }}>
          Catálogo, pedidos, inventario, ventas y facturación electrónica.
          Cada rol ve únicamente lo que necesita.
        </p>

        <div className="portada-heroe-acciones" style={{ marginTop: 22, gap: 10 }}>
          <Link to="/registro" className="dt-accion-principal" style={{ padding: "10px 18px", fontSize: 13 }}>
            Empezar ahora <ArrowRight size={14} />
          </Link>
          <Link to="/login" className="dt-boton-secundario" style={ESTILO_BOTON_FANTASMA}>
            Ya tengo cuenta
          </Link>
        </div>

        <ul className="portada-lista" style={{ marginTop: 22, gap: 8 }}>
          <li style={{ ...TEXTO_CLARO, fontSize: 12.5 }}>
            <Check size={14} style={{ color: "#ffc145" }} /> Control de stock con alertas
          </li>
          <li style={{ ...TEXTO_CLARO, fontSize: 12.5 }}>
            <Check size={14} style={{ color: "#ffc145" }} /> Pedidos y devoluciones trazables
          </li>
          <li style={{ ...TEXTO_CLARO, fontSize: 12.5 }}>
            <Check size={14} style={{ color: "#ffc145" }} /> Facturación DIAN simulada, lista para conectar
          </li>
        </ul>
      </section>

      {/* ------------------------------------------------------- Beneficios */}
      <section
        id="quehacemos"
        className="portada-beneficios"
        style={{ ...ESTILO_SECCION, gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}
      >
        {BENEFICIOS.map((beneficio) => (
          <article
            key={beneficio.titulo}
            className="portada-beneficio"
            style={{ ...ESTILO_TARJETA_BLANCA, padding: 18 }}
          >
            <span className="dt-acceso-icono">
              <beneficio.Icono size={17} />
            </span>
            <strong style={{ fontSize: 14 }}>{beneficio.titulo}</strong>
            <span style={{ fontSize: 12 }}>{beneficio.detalle}</span>
          </article>
        ))}
      </section>

      {/* ------------------------------------------------------------ Pasos */}
      <section
        id="como-funciona"
        className="portada-pasos"
        style={{ ...ESTILO_SECCION, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
      >
        {PASOS.map((paso) => (
          <article
            key={paso.numero}
            className="portada-paso"
            style={{ ...ESTILO_TARJETA_BLANCA, padding: 16 }}
          >
            <span className="portada-paso-numero">{paso.numero}</span>
            <strong style={{ fontSize: 13 }}>{paso.titulo}</strong>
            <span style={{ fontSize: 12 }}>{paso.detalle}</span>
          </article>
        ))}
      </section>

      {/* --------------------------------------------------------- Contacto */}
      <section id="contacto" className="portada-contacto" style={ESTILO_CONTACTO_SECCION}>
        <div className="portada-contacto-grid" style={ESTILO_CONTACTO_PANEL}>
          <div className="portada-contacto-info" style={ESTILO_CONTACTO_INFO}>
            <span
              className="etiqueta"
              style={{
                color: "#16213a",
                background: "#ffc145",
                borderColor: "#ffc145",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 1.2,
              }}
            >
              CONTACTO
            </span>

            <h2 style={ESTILO_CONTACTO_TITULO}>Contáctanos</h2>
            <p style={ESTILO_CONTACTO_LEAD}>
              ¿Tienes una duda o un reclamo? Escríbenos y te respondemos el mismo día hábil.
            </p>

            <div style={{ marginTop: 6 }}>
              <div style={ESTILO_CONTACTO_ITEM}>
                <span style={ESTILO_CONTACTO_ICONO}>
                  <i className="bi bi-telephone" aria-hidden="true" />
                </span>
                <span>+57 321 209 9989</span>
              </div>
              <div style={ESTILO_CONTACTO_ITEM}>
                <span style={ESTILO_CONTACTO_ICONO}>
                  <i className="bi bi-envelope" aria-hidden="true" />
                </span>
                <span>dotaciones.elobrero@gmail.com</span>
              </div>
              <div style={ESTILO_CONTACTO_ITEM}>
                <span style={ESTILO_CONTACTO_ICONO}>
                  <i className="bi bi-geo-alt" aria-hidden="true" />
                </span>
                <span>Carrera 63 Sur #21-12, Bogotá D.C., Colombia</span>
              </div>
              <div style={ESTILO_CONTACTO_ITEM}>
                <span style={ESTILO_CONTACTO_ICONO}>
                  <i className="bi bi-clock" aria-hidden="true" />
                </span>
                <div>
                  <div>Lunes a viernes: 8am – 6pm</div>
                  <div>Sábado: 9am – 2pm</div>
                  <div>Domingo: cerrado</div>
                </div>
              </div>
            </div>
          </div>

          <div className="portada-tablero" style={ESTILO_FORM_CONTACTO}>
            {enviado ? (
              <div className="portada-tablero-ok">
                <Check size={26} />
                <h3>¡Mensaje enviado!</h3>
                <p>Gracias por escribirnos. Te responderemos el mismo día hábil.</p>
                <button
                  type="button"
                  className="dt-boton-secundario"
                  onClick={() => setEnviado(false)}
                >
                  Enviar otro mensaje
                </button>
              </div>
            ) : (
              <form className="portada-tablero-form" onSubmit={enviarContacto}>
                <label>
                  Nombre
                  <input
                    type="text"
                    name="nombre"
                    placeholder="¿Cómo te llamas?"
                    value={contacto.nombre}
                    onChange={cambiarContacto}
                    required
                  />
                </label>

                <label>
                  Correo electrónico
                  <input
                    type="email"
                    name="correo"
                    placeholder="tucorreo@ejemplo.com"
                    value={contacto.correo}
                    onChange={cambiarContacto}
                    required
                  />
                </label>

                <label>
                  Mensaje
                  <textarea
                    name="mensaje"
                    placeholder="Cuéntanos qué necesitas"
                    value={contacto.mensaje}
                    onChange={cambiarContacto}
                    required
                  />
                </label>

                <button type="submit" className="dt-accion-principal portada-tablero-enviar">
                  Enviar mensaje <ArrowRight size={14} />
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- Pie */}
      <footer className="portada-footer">
        <div className="portada-footer-grid">
          <div>
            <div className="marca" style={ESTILO_MARCA_CLARA}>
              <span className="marca-icono-solido">
                <Package size={18} />
              </span>
              Dotaciones <span className="marca-verde">Toronto</span>
            </div>
            <p>
              Distribución de dotaciones y equipos de protección personal para la industria,
              en Bogotá desde hace 13 años.
            </p>
          </div>

          <div>
            <h5>Navegación</h5>
            <ul>
              <li>
                <a href="#quehacemos">Qué hacemos</a>
              </li>
              <li>
                <a href="#como-funciona">Cómo funciona</a>
              </li>
              <li>
                <a href="#contacto">Contacto</a>
              </li>
              <li>
                <Link to="/login">Iniciar sesión</Link>
              </li>
              <li>
                <Link to="/registro">Registrarse</Link>
              </li>
            </ul>
          </div>

          <div>
            <h5>Horario de atención</h5>
            <ul className="portada-footer-estatico">
              <li>Lunes a viernes: 8am – 6pm</li>
              <li>Sábado: 9am – 2pm</li>
              <li>Domingo: cerrado</li>
            </ul>
          </div>
        </div>

        <div className="portada-footer-linea">
          <div className="portada-footer-base">
            <span>© 2026 Dotaciones Toronto. Todos los derechos reservados.</span>
            <span>Bogotá D.C., Colombia</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
