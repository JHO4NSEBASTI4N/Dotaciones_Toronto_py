// src/pages/error/general.tsx
//
// Pantalla de error general: se muestra cuando ocurre una falla inesperada en
// la interfaz (capturada por LimiteErrores) o al entrar a /error/general.
// No depende del contexto de sesión para que funcione incluso si el fallo
// ocurrió al inicializar la aplicación.

import { ArrowLeft, RefreshCw } from "../../components/iconos";
import imagenErrorGeneral from "../../assets/images/error-general.png";

interface PropsErrorGeneral {
  onReintentar?: () => void;
}

export default function ErrorGeneral({ onReintentar }: PropsErrorGeneral) {
  const irAlInicio = () => {
    window.location.assign("/");
  };

  const reintentar = () => {
    if (onReintentar) {
      onReintentar();
      return;
    }
    window.location.reload();
  };

  return (
    <main className="error-pagina error-pagina--general" role="alert">
      <img
        src={imagenErrorGeneral}
        alt="Falla mayor del sistema: disculpas, un error interno no permite completar la solicitud."
        className="error-ilustracion"
      />

      <div className="error-acciones">
        <button
          type="button"
          className="error-boton error-boton--primario"
          onClick={irAlInicio}
        >
          <ArrowLeft size={15} /> Volver al inicio
        </button>

        <button
          type="button"
          className="error-boton error-boton--secundario"
          onClick={reintentar}
        >
          <RefreshCw size={15} /> Reintentar
        </button>
      </div>
    </main>
  );
}
