// src/pages/index.tsx
//
// index.html del proyecto Java: la portada pública.
// Muestra qué hace el sistema y lleva a iniciar sesión o a registrarse.

import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight,
  Boxes,
  Check,
  ClipboardList,
  CreditCard,
  Package,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
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

export default function Portada() {
  const { usuario, cargando } = useSesion();

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

      <section className="portada-beneficios">
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

      <section className="portada-pasos">
        {PASOS.map((paso) => (
          <article key={paso.numero} className="portada-paso">
            <span className="portada-paso-numero">{paso.numero}</span>
            <strong>{paso.titulo}</strong>
            <span>{paso.detalle}</span>
          </article>
        ))}
      </section>

      <footer className="portada-pie">
        <span>
          <ShieldCheck size={13} /> Proyecto académico · SENA · ADSO
        </span>
        <span>
          <ClipboardList size={13} /> Dotaciones Toronto · Colombia
        </span>
        <span>
          <Truck size={13} /> Envíos a todo el país
        </span>
      </footer>
    </div>
  );
}
