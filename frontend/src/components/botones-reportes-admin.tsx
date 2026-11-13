import { useState } from "react";
import { ArrowDownToLine, FileText } from "./iconos";
import { descargarReporteAdmin, type ReporteAdmin } from "../services/reportes";

interface PropsBotonesReportes {
  crearReporte: () => ReporteAdmin | Promise<ReporteAdmin>;
  alError: (mensaje: string) => void;
  deshabilitado?: boolean;
}

export function BotonesReportesAdmin({
  crearReporte,
  alError,
  deshabilitado = false,
}: PropsBotonesReportes) {
  const [descargando, setDescargando] = useState<"excel" | "pdf" | null>(null);

  const descargar = async (formato: "excel" | "pdf") => {
    setDescargando(formato);
    alError("");

    try {
      const reporte = await crearReporte();
      await descargarReporteAdmin(reporte, formato);
    } catch (fallo) {
      alError(fallo instanceof Error ? fallo.message : "No se pudo generar el reporte.");
    } finally {
      setDescargando(null);
    }
  };

  return (
    <div className="dt-botones-reportes" aria-label="Descargar reportes">
      <button
        type="button"
        className="dt-boton-reporte dt-boton-reporte-excel"
        onClick={() => void descargar("excel")}
        disabled={deshabilitado || descargando !== null}
        title="Descargar reporte Excel con gráfica editable"
      >
        <ArrowDownToLine size={15} />
        {descargando === "excel" ? "Preparando…" : "Excel"}
      </button>
      <button
        type="button"
        className="dt-boton-reporte dt-boton-reporte-pdf"
        onClick={() => void descargar("pdf")}
        disabled={deshabilitado || descargando !== null}
        title="Descargar reporte en PDF"
      >
        <FileText size={15} />
        {descargando === "pdf" ? "Preparando…" : "PDF"}
      </button>
    </div>
  );
}
