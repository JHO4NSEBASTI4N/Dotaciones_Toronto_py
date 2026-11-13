import { BASE_URL, ErrorApi } from "./api";

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
  const respuesta = await fetch(`${BASE_URL}/reportes/admin/${formato}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(reporte),
  });

  if (!respuesta.ok) {
    let mensaje = `No se pudo generar el reporte (${respuesta.status}).`;
    try {
      const datos: unknown = await respuesta.json();
      if (typeof datos === "object" && datos !== null && "detail" in datos) {
        const detalle = (datos as { detail?: unknown }).detail;
        if (typeof detalle === "string") mensaje = detalle;
        else if (Array.isArray(detalle)) {
          mensaje = detalle
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
