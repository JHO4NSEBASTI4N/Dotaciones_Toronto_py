// src/pages/error/404.tsx
//
// templates/error/404.html del proyecto Java: la dirección no existe.
// Se muestra solo la imagen de fondo y el botón de volver al panel.

import { Link } from "react-router-dom";
import { ArrowLeft } from "../../components/iconos";

export default function Error404() {
  return (
    <div className="error-pagina error-pagina--404">
      <div className="error-acciones">
        <Link to="/login" className="dt-accion-principal">
          <ArrowLeft size={15} /> Volver al inicio
        </Link>
      </div>
    </div>
  );
}