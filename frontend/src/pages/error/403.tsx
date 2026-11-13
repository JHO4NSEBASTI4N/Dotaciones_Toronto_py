// src/pages/error/403.tsx
//
// templates/error/403.html del proyecto Java: el rol no tiene permiso.

import { Link } from "react-router-dom";
import { ArrowLeft, Lock } from "../../components/iconos";
import { useSesion } from "../../context/sesion-contexto";

export default function Error403() {
  const { usuario } = useSesion();

  const inicio =
    { 1: "/admin/panel", 2: "/cliente/panel", 3: "/vendedor/panel", 4: "/bodeguero/panel" }[
      usuario?.id_rol ?? 0
    ] ?? "/login";

  return (
    <div className="error-pagina">
      <span className="error-codigo">403</span>
      <span className="error-icono">
        <Lock size={28} />
      </span>
      <h1>No tienes permiso para entrar aquí</h1>
      <p>
        Tu rol actual{usuario ? ` (${usuario.nombre_rol})` : ""} no tiene este
        módulo. Si lo necesitas, cambia de rol o pídeselo al administrador.
      </p>
      <div className="error-acciones">
        <Link to={inicio} className="dt-accion-principal">
          <ArrowLeft size={15} /> Volver a mi panel
        </Link>
      </div>
    </div>
  );
}
