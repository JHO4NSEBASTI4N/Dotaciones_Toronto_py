// src/pages/error/404.tsx
//
// Pantalla de error 404: la ruta o el recurso solicitado no existe.

import { Link } from "react-router-dom";
import { ArrowLeft } from "../../components/iconos";
import { useSesion } from "../../context/sesion-contexto";
import imagenError404 from "./error-404.png";

const RUTA_PANEL: Record<number, string> = {
  1: "/admin/panel",
  2: "/cliente/panel",
  3: "/vendedor/panel",
  4: "/bodeguero/panel",
};

export default function Error404() {
  const { usuario } = useSesion();
  const destinoPanel = usuario ? RUTA_PANEL[usuario.id_rol] : undefined;

  return (
    <main className="error-pagina error-pagina--404" role="alert">
      <img
        src={imagenError404}
        alt="Error 404: ¡UY! Parece que nos hemos descolgado. No encontramos la página que buscas."
        className="error-ilustracion"
      />

      <div className="error-acciones">
        {destinoPanel ? (
          <Link to={destinoPanel} className="error-boton error-boton--primario">
            <ArrowLeft size={15} /> Volver a mi panel
          </Link>
        ) : (
          <>
            <Link to="/" className="error-boton error-boton--primario">
              <ArrowLeft size={15} /> Volver al inicio
            </Link>
            <Link to="/login" className="error-boton error-boton--secundario">
              Iniciar sesión
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
