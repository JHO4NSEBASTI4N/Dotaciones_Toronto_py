import { BASE_URL, ErrorApi, notificarPaginaError } from "./api";

export type ModuloReporte =
  | "panel"
  | "productos"
  | "pedidos"
  | "ventas"
  | "devoluciones"
  | "inventario"
  | "usuarios"
  | "facturacion";

export interface ColumnaReporte {
  clave: string;
  titulo: string;
}

export interface IndicadorReporte {
  etiqueta: string;
  valor: string;
}

export interface GraficaReporte {
  titulo: string;
  tipo: "columna" | "linea";
  categorias: string[];
  series: { nombre: string; valores: number[] }[];
}

export interface ReporteAdmin {
  modulo: ModuloReporte;
  titulo: string;
  generado_por: string;
  indicadores: IndicadorReporte[];
  columnas: ColumnaReporte[];
  filas: Record<string, string | number | boolean | null>[];
  grafica: GraficaReporte;
}

export async function descargarReporteAdmin(
  reporte: ReporteAdmin,
  formato: "excel" | "pdf"
): Promise<void> {
  const token = localStorage.getItem("token");
  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE_URL}/reportes/admin/${formato}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(reporte),
    });
  } catch {
    const mensajeRed =
      "No se pudo contactar el servidor para generar el reporte.";
    notificarPaginaError("500", mensajeRed);
    throw new ErrorApi(mensajeRed, 0);
  }

  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      localStorage.removeItem("rol_activo");
    }

    let mensaje = `No se pudo generar el reporte (${respuesta.status}).`;
    try {
      const datos: unknown = await respuesta.json();
      if (typeof datos === "object" && datos !== null) {
        const cuerpo = datos as { detalle?: unknown; detail?: unknown };
        if (typeof cuerpo.detalle === "string") {
          mensaje = cuerpo.detalle;
        } else if (typeof cuerpo.detail === "string") {
          mensaje = cuerpo.detail;
        } else if (Array.isArray(cuerpo.detail)) {
          mensaje = cuerpo.detail
            .map((item) =>
              typeof item === "object" && item !== null && "msg" in item
                ? String((item as { msg: unknown }).msg)
                : ""
            )
            .filter(Boolean)
            .join(". ");
        }
      }
    } catch {
      // La respuesta de error puede no venir en JSON.
    }

    if (respuesta.status >= 500) {
      notificarPaginaError("500", mensaje);
    } else if (respuesta.status === 403) {
      notificarPaginaError("403", mensaje);
    }

    throw new ErrorApi(mensaje, respuesta.status);
  }

  const archivo = await respuesta.blob();
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement("a");
  const fecha = new Date().toISOString().slice(0, 10);
  enlace.href = url;
  enlace.download = `reporte_${reporte.modulo}_${fecha}.${formato === "excel" ? "xlsx" : "pdf"}`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
