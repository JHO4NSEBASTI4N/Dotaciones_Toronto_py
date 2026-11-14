import type { GraficaReporte } from "./reportes";

export function contarPorCategoria(
  categorias: string[],
  tituloGrafica: string,
  nombreSerie = "Registros"
): GraficaReporte {
  const conteos = new Map<string, number>();
  for (const valor of categorias) {
    const etiqueta = valor.trim() || "Sin clasificar";
    conteos.set(etiqueta, (conteos.get(etiqueta) ?? 0) + 1);
  }

  const ordenadas = [...conteos.entries()].sort((a, b) => b[1] - a[1]);
  if (ordenadas.length > 12) {
    const principales = ordenadas.slice(0, 12);
    const otros = ordenadas.slice(12).reduce((total, [, cantidad]) => total + cantidad, 0);
    ordenadas.splice(0, ordenadas.length, ...principales, ["Otros", otros]);
  }
  if (ordenadas.length === 0) ordenadas.push(["Sin registros", 0]);

  return {
    titulo: tituloGrafica,
    tipo: "columna",
    categorias: ordenadas.map(([etiqueta]) => etiqueta),
    series: [{ nombre: nombreSerie, valores: ordenadas.map(([, cantidad]) => cantidad) }],
  };
}

export function resumirVentasPorMes(
  ventas: { fecha_venta: string | null; total_pagado: string; estado: string }[],
  cantidadMeses = 12
): GraficaReporte {
  const totales = new Map<string, number>();
  for (const venta of ventas) {
    if (venta.estado !== "Completada" || !venta.fecha_venta) continue;
    const fecha = new Date(venta.fecha_venta);
    if (Number.isNaN(fecha.getTime())) continue;
    const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
    totales.set(clave, (totales.get(clave) ?? 0) + Number(venta.total_pagado || 0));
  }

  const hoy = new Date();
  const meses = Array.from({ length: cantidadMeses }, (_, indice) => {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - cantidadMeses + 1 + indice, 1);
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
  });

  return {
    titulo: "Ingresos por mes (ventas completadas)",
    tipo: "linea",
    categorias: meses.map((mes) => {
      const [anio, numeroMes] = mes.split("-");
      return new Date(Number(anio), Number(numeroMes) - 1, 1).toLocaleDateString("es-CO", {
        month: "short",
        year: "2-digit",
      });
    }),
    series: [
      {
        nombre: "Ingresos COP",
        valores: meses.map((mes) => Math.round(totales.get(mes) ?? 0)),
      },
    ],
  };
}
