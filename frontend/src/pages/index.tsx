// src/pages/index.tsx
//
// index.html del proyecto Java: la portada pública.
// Muestra qué hace el sistema, cómo funciona, contacto y pie de página.

import { useState, type ChangeEvent, type FormEvent } from "react";
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
    <div className="portada">
      <header className="portada-barra">
        <div className="marca marca-oscura">
          <span className="marca-icono-solido">
            <Package size={20} />
          </span>
          Dotaciones <span className="marca-verde">Toronto</span>
        </div>

        <nav className="portada-barra-acciones">
          <Link to="/login" className="dt-boton-secundario">
            Iniciar sesión
          </Link>
          <Link to="/registro" className="dt-accion-principal">
            Crear cuenta <ArrowRight size={14} />
          </Link>
        </nav>
      </header>

      <section className="portada-heroe">
        <span className="etiqueta etiqueta-oscura">DOTACIONES EMPRESARIALES</span>
        <h1>
          Toda la dotación de tu empresa,
          <br />
          pedida y controlada en un solo lugar.
        </h1>
        <p>
          Catálogo, pedidos, inventario, ventas y facturación electrónica.
          Cada rol ve únicamente lo que necesita.
        </p>

        <div className="portada-heroe-acciones">
          <Link to="/registro" className="dt-accion-principal">
            Empezar ahora <ArrowRight size={15} />
          </Link>
          <Link to="/login" className="dt-boton-secundario">
            Ya tengo cuenta
          </Link>
        </div>

        <ul className="portada-lista">
          <li>
            <Check size={15} /> Control de stock con alertas
          </li>
          <li>
            <Check size={15} /> Pedidos y devoluciones trazables
          </li>
          <li>
            <Check size={15} /> Facturación DIAN simulada, lista para conectar
          </li>
        </ul>
      </section>

      <section id="quehacemos" className="portada-beneficios">
        {BENEFICIOS.map((beneficio) => (
          <article key={beneficio.titulo} className="portada-beneficio">
            <span className="dt-acceso-icono">
              <beneficio.Icono size={18} />
            </span>
            <strong>{beneficio.titulo}</strong>
            <span>{beneficio.detalle}</span>
          </article>
        ))}
      </section>

      <section id="como-funciona" className="portada-pasos">
        {PASOS.map((paso) => (
          <article key={paso.numero} className="portada-paso">
            <span className="portada-paso-numero">{paso.numero}</span>
            <strong>{paso.titulo}</strong>
            <span>{paso.detalle}</span>
          </article>
        ))}
      </section>

      <section id="contacto" className="portada-contacto">
        <div className="portada-contacto-grid">
          <div className="portada-contacto-info">
            <span className="etiqueta etiqueta-oscura">CONTACTO</span>
            <h2>Contáctanos</h2>
            <p className="portada-contacto-lead">
              ¿Tienes una duda o un reclamo? Escríbenos y te respondemos el mismo día hábil.
            </p>

            <div className="portada-contacto-item">
              <i className="bi bi-telephone" aria-hidden="true" />
              <span>+57 321 209 9989</span>
            </div>
            <div className="portada-contacto-item">
              <i className="bi bi-envelope" aria-hidden="true" />
              <span>dotaciones.elobrero@gmail.com</span>
            </div>
            <div className="portada-contacto-item">
              <i className="bi bi-geo-alt" aria-hidden="true" />
              <span>Carrera 63 Sur #21-12, Bogotá D.C., Colombia</span>
            </div>
            <div className="portada-contacto-item">
              <i className="bi bi-clock" aria-hidden="true" />
              <div>
                <div>Lunes a viernes: 8am – 6pm</div>
                <div>Sábado: 9am – 2pm</div>
                <div>Domingo: cerrado</div>
              </div>
            </div>
          </div>

          <div className="portada-tablero">
            <span className="portada-tablero-clip" aria-hidden="true" />

            {enviado ? (
              <div className="portada-tablero-ok">
                <Check size={28} />
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

      <footer className="portada-footer">
        <div className="portada-footer-grid">
          <div>
            <div className="marca">
              <span className="marca-icono-solido">
                <Package size={20} />
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