// src/pages/error/403.tsx
//
// Pantalla de error 403: el usuario o su rol activo no tiene permiso para
// acceder a esta área u operación.

import { Link } from "react-router-dom";
import { ArrowLeft } from "../../components/iconos";
import { useSesion } from "../../context/sesion-contexto";
import imagenError403 from "./error-403.png";

const RUTA_PANEL: Record<number, string> = {
  1: "/admin/panel",
  2: "/cliente/panel",
  3: "/vendedor/panel",
  4: "/bodeguero/panel",
};

export default function Error403() {
  const { usuario } = useSesion();
  const destinoPanel = usuario ? RUTA_PANEL[usuario.id_rol] : undefined;

  return (
    <main className="error-pagina error-pagina--403" role="alert">
      <img
        src={imagenError403}
        alt="Error 403: ¡ALTO! No tienes permiso para esta área. Lo sentimos, el acceso a esta página está restringido."
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
