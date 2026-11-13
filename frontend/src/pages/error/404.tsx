// src/pages/error/404.tsx
//
// templates/error/404.html del proyecto Java: la dirección no existe.

import { Link } from "react-router-dom";
import { ArrowLeft, Search } from "../../components/iconos";

export default function Error404() {
  return (
    <div className="error-pagina">
      <span className="error-codigo">404</span>
      <span className="error-icono">
        <Search size={28} />
      </span>
      <h1>Esta página no existe</h1>
      <p>
        La dirección a la que intentaste entrar no está en el sistema. Revisa el
        enlace o vuelve al inicio.
      </p>
      <div className="error-acciones">
        <Link to="/login" className="dt-accion-principal">
          <ArrowLeft size={15} /> Ir al inicio de sesión
        </Link>
      </div>
    </div>
  );
}
