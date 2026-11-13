// src/pages/error/500.tsx
//
// templates/error/500.html del proyecto Java: fallo del servidor o de la red.

import { Link } from "react-router-dom";
import { ArrowLeft, TriangleAlert } from "../../components/iconos";

export default function Error500() {
  return (
    <div className="error-pagina">
      <span className="error-codigo">500</span>
      <span className="error-icono">
        <TriangleAlert size={28} />
      </span>
      <h1>Algo falló de nuestro lado</h1>
      <p>
        No pudimos completar la operación. Revisa que el backend esté encendido y
        vuelve a intentarlo en un momento.
      </p>
      <div className="error-acciones">
        <Link to="/login" className="dt-accion-principal">
          <ArrowLeft size={15} /> Volver al inicio
        </Link>
        <button type="button" className="dt-boton-secundario" onClick={() => window.location.reload()}>
          Reintentar
        </button>
      </div>
    </div>
  );
}
