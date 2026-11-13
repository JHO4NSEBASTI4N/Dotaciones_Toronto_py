// src/pages/error/500.tsx
//
// templates/error/500.html del proyecto Java: fallo del servidor o de la red.
// Se muestra solo la imagen de fondo y el botón de volver al panel.

import { Link } from "react-router-dom";
import { ArrowLeft } from "../../components/iconos";

export default function Error500() {
  return (
    <div className="error-pagina error-pagina--500">
      <div className="error-acciones">
        <Link to="/login" className="dt-accion-principal">
          <ArrowLeft size={15} /> Volver al inicio
        </Link>
      </div>
    </div>
  );
}