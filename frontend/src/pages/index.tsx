// src/pages/Index.tsx

import { Fragment, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { autenticacion } from "../services/autenticacion";
import logo from "../assets/logo-negro.png";

const ESTADISTICAS = [
  "13 años en el mercado",
  "+500 empresas atendidas",
  "+50 referencias en catálogo",
  "Entrega en toda Bogotá",
  "EPP certificado",
];

const SERVICIOS = [
  {
    icono: "bi-shield-check",
    titulo: "Equipos de protección",
    texto:
      "Cascos, guantes, botas y elementos EPP certificados, listos para operar desde el primer día.",
  },
  {
    icono: "bi-person-workspace",
    titulo: "Uniformes industriales",
    texto:
      "Overoles, camisas y pantalones resistentes para construcción, salud, manufactura y logística.",
  },
  {
    icono: "bi-truck",
    titulo: "Distribución confiable",
    texto:
      "Trece años despachando pedidos a tiempo, con reposición ágil cuando el inventario se agota.",
  },
];

const PRODUCTOS = [
  { icono: "bi-person-standing", nombre: "Pantalón de jean" },
  { icono: "bi-person-badge", nombre: "Overol" },
  { icono: "bi-bootstrap", nombre: "Botas" },
  { icono: "bi-hand-index", nombre: "Guantes" },
  { icono: "bi-shield-fill", nombre: "Casco" },
];

function Index() {
  const [enviado, setEnviado] = useState(false);
  const sesionIniciada = autenticacion.estaAutenticado();

  const enviarMensaje = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.currentTarget.reset();
    setEnviado(true);
  };

  return (
    <div className="landing">
      {/* HAZARD STRIPE */}
      <div className="hazard-strip" aria-hidden="true"></div>

      {/* NAVBAR */}
      <nav className="navbar-dt navbar-sticky">
        <div className="container navbar-inner">
          <Link to="/" className="navbar-brand">
            <img src={logo} alt="Dotaciones Toronto" />
            <span>Dotaciones Toronto</span>
          </Link>

          <ul className="navbar-links">
            <li><a href="#quehacemos">Qué hacemos</a></li>
            <li><a href="#productos">Productos</a></li>
            <li><a href="#contacto">Contacto</a></li>
          </ul>

          <div className="navbar-actions">
            {sesionIniciada ? (
              <Link to="/dashboard" className="btn-primary-dt">Ir al panel</Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost">Iniciar sesión</Link>
                <Link to="/registro" className="btn-primary-dt">Registrarse</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-ribbon" aria-hidden="true"></div>
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="hero-kicker">Distribuidor de dotación industrial en Bogotá</p>
            <h1>
              Ropa de trabajo<br />que aguanta<br />el turno completo.
            </h1>
            <p className="hero-lead">
              Uniformes y equipos de protección personal para construcción, salud,
              manufactura y logística. Tallas completas, entrega rápida y asesoría
              para elegir lo que tu equipo realmente necesita.
            </p>
            <div className="hero-actions">
              <Link to="/registro" className="btn-hero-primary">Crear cuenta</Link>
              <a href="#productos" className="btn-hero-secondary">Ver catálogo</a>
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="hero-tag">
              <i className="bi bi-shield-check"></i>
              <span>EPP certificado</span>
            </div>
            <div className="hero-swatches">
              <div className="swatch swatch-a"></div>
              <div className="swatch swatch-b"></div>
              <div className="swatch swatch-c"></div>
            </div>
          </div>
        </div>
      </section>

      {/* STAT MARQUEE */}
      <div className="marquee">
        <div className="marquee-track">
          {[...ESTADISTICAS, ...ESTADISTICAS].map((texto, i) => (
            <Fragment key={i}>
              <span>{texto}</span>
              <span>·</span>
            </Fragment>
          ))}
        </div>
      </div>

      {/* QUÉ HACEMOS */}
      <section id="quehacemos" className="features">
        <div className="container">
          <div className="section-head">
            <h2>Qué hacemos</h2>
            <p>Tres frentes, un mismo estándar de calidad.</p>
          </div>
          <div className="features-grid">
            {SERVICIOS.map((s) => (
              <div className="tag-card" key={s.titulo}>
                <div className="tag-icon"><i className={`bi ${s.icono}`}></i></div>
                <h4>{s.titulo}</h4>
                <p>{s.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCTOS */}
      <section id="productos" className="productos">
        <div className="container">
          <div className="section-head">
            <h2>Nuestros productos</h2>
            <p>Lo esencial para vestir a tu equipo de trabajo.</p>
          </div>
        </div>
        <div className="rack">
          <div className="rack-rod" aria-hidden="true"></div>
          <div className="rack-row">
            {PRODUCTOS.map((p) => (
              <div className="hang-card" key={p.nombre}>
                <div className="hang-hook" aria-hidden="true"></div>
                <i className={`bi ${p.icono}`}></i>
                <h4>{p.nombre}</h4>
                <span className="hang-status">Disponible</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACTO */}
      <section id="contacto" className="contacto">
        <div className="container contacto-grid">
          <div className="contacto-info">
            <h2>Contáctanos</h2>
            <p className="contacto-lead">
              ¿Tienes una duda o un reclamo? Escríbenos y te respondemos el mismo día hábil.
            </p>
            <div className="contacto-item">
              <i className="bi bi-telephone"></i>
              <span>+57 321 209 9989</span>
            </div>
            <div className="contacto-item">
              <i className="bi bi-envelope"></i>
              <span>dotaciones.elobrero@gmail.com</span>
            </div>
            <div className="contacto-item">
              <i className="bi bi-geo-alt"></i>
              <span>Carrera 63 Sur #21-12, Bogotá D.C., Colombia</span>
            </div>
            <div className="contacto-item">
              <i className="bi bi-clock"></i>
              <div>
                <div>Lunes a viernes: 8am – 6pm</div>
                <div>Sábado: 9am – 2pm</div>
                <div>Domingo: cerrado</div>
              </div>
            </div>
          </div>

          <div className="clipboard">
            <div className="clipboard-clip" aria-hidden="true"></div>
            <form className="clipboard-form" onSubmit={enviarMensaje}>
              {enviado && (
                <div className="alert alert-success py-2 px-3 fs-6">
                  Mensaje enviado. Te responderemos pronto.
                </div>
              )}
              <label>
                Nombre
                <input type="text" placeholder="¿Cómo te llamas?" required />
              </label>
              <label>
                Correo electrónico
                <input type="email" placeholder="tucorreo@ejemplo.com" required />
              </label>
              <label>
                Mensaje
                <textarea placeholder="Cuéntanos qué necesitas" required></textarea>
              </label>
              <button type="submit" className="btn-enviar">Enviar mensaje</button>
            </form>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <img src={logo} alt="Dotaciones Toronto" className="footer-logo" />
            <p>
              Distribución de dotaciones y equipos de protección personal para la
              industria, en Bogotá desde hace 13 años.
            </p>
          </div>
          <div className="footer-col">
            <h5>Navegación</h5>
            <ul>
              <li><a href="#quehacemos">Qué hacemos</a></li>
              <li><a href="#productos">Productos</a></li>
              <li><a href="#contacto">Contacto</a></li>
              <li><Link to="/login">Iniciar sesión</Link></li>
              <li><Link to="/registro">Registrarse</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h5>Horario de atención</h5>
            <ul className="footer-static">
              <li>Lunes a viernes: 8am – 6pm</li>
              <li>Sábado: 9am – 2pm</li>
              <li>Domingo: cerrado</li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="container footer-bottom-inner">
            <p>© 2026 Dotaciones Toronto. Todos los derechos reservados.</p>
            <p>Bogotá D.C., Colombia</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Index;