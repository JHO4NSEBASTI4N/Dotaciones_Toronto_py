// src/pages/error/500.tsx
//
// Pantalla de error 500: fallo interno del servidor, base de datos no
// disponible o imposibilidad de conexión con el backend.

import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "../../components/iconos";
import { useSesion } from "../../context/sesion-contexto";
import { autenticacion } from "../../services/autenticacion";
import imagenError500 from "./error-500.png";

const RUTA_PANEL: Record<number, string> = {
  1: "/admin/panel",
  2: "/cliente/panel",
  3: "/vendedor/panel",
  4: "/bodeguero/panel",
};

interface EstadoRutaError {
  origen?: string;
  mensaje?: string;
}

export default function Error500() {
  const { usuario, recargar } = useSesion();
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const [reintentando, setReintentando] = useState(false);

  const estado = (ubicacion.state as EstadoRutaError | null) ?? null;
  const origen =
    estado?.origen && !estado.origen.startsWith("/error/")
      ? estado.origen
      : undefined;

  const destinoInicio = (usuario && RUTA_PANEL[usuario.id_rol]) || "/";

  const reintentar = async () => {
    setReintentando(true);
    try {
      if (!usuario && autenticacion.estaAutenticado()) {
        const recuperada = await recargar();
        if (!recuperada) return;
      }
      if (origen) {
        navegar(origen, { replace: true });
      } else {
        navegar(destinoInicio, { replace: true });
      }
    } finally {
      setReintentando(false);
    }
  };

  return (
    <main className="error-pagina error-pagina--500" role="alert">
      <img
        src={imagenError500}
        alt="Error 500: ¡ERROR CRÍTICO! El servidor ha colapsado. Lo sentimos, estamos experimentando una falla interna."
        className="error-ilustracion"
      />

      <div className="error-acciones">
        <Link to={destinoInicio} className="error-boton error-boton--primario">
          <ArrowLeft size={15} /> {usuario ? "Volver a mi panel" : "Volver al inicio"}
        </Link>

        <button
          type="button"
          className="error-boton error-boton--secundario"
          onClick={() => void reintentar()}
          disabled={reintentando}
        >
          <RefreshCw size={15} /> {reintentando ? "Reintentando…" : "Reintentar"}
        </button>
      </div>
    </main>
  );
}
