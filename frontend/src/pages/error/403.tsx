// src/pages/error/403.tsx
//
// templates/error/403.html del proyecto Java: el rol no tiene permiso.
// Se muestra solo la imagen de fondo y el botón de volver al panel.

import { Link } from "react-router-dom";
import { ArrowLeft } from "../../components/iconos";
import { useSesion } from "../../context/sesion-contexto";

export default function Error403() {
  const { usuario } = useSesion();

  const inicio =
    { 1: "/admin/panel", 2: "/cliente/panel", 3: "/vendedor/panel", 4: "/bodeguero/panel" }[
      usuario?.id_rol ?? 0
    ] ?? "/login";

  return (
    <div className="error-pagina error-pagina--403">
      <div className="error-acciones">
        <Link to={inicio} className="dt-accion-principal">
          <ArrowLeft size={15} /> Volver a mi panel
        </Link>
      </div>
    </div>
  );
}