// src/components/grafica-ingresos.tsx
//
// Grafica de barras de ingresos por mes, construida en SVG puro con TypeScript.
// No usa ninguna libreria de graficos en JavaScript: todo se dibuja con
// elementos SVG para integrarse sin dependencias nuevas al proyecto.

import { useMemo } from "react";

import { pesos } from "../services/api";
import type { IngresoPorMes } from "../types";

const COLOR_BARRA = "#fa813b";
const COLOR_LINEA = "#e8ecf3";
const COLOR_TEXTO = "#4a5568";

/** "2026-11" -> "Nov". */
function mesCorto(periodo: string): string {
  const partes = periodo.split("-");
  const nombres = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  const mes = Number(partes[1]);
  return nombres[mes - 1] ?? periodo;
}

/** "2026-11" -> "Nov 2026". */
function mesConAnio(periodo: string): string {
  const partes = periodo.split("-");
  return `${mesCorto(periodo)} ${partes[0]}`;
}

/** Redondea un valor al siguiente "nice" (1, 2, 5 x potencia de 10). */
function maximoBonito(valor: number): number {
  if (valor <= 0) return 100;
  const exponente = Math.floor(Math.log10(valor));
  const base = Math.pow(10, exponente);
  const fraccion = valor / base;
  const bonito =
    fraccion <= 1 ? 1 : fraccion <= 2 ? 2 : fraccion <= 5 ? 5 : 10;
  return bonito * base;
}

interface Props {
  datos: IngresoPorMes[];
  cargando: boolean;
}

export default function GraficaIngresos({ datos, cargando }: Props) {
  const geometria = useMemo(() => {
    if (datos.length === 0) return null;

    const ingresos = datos.map((d) => Number(d.ingreso) || 0);
    const maximo = Math.max(...ingresos, 0);
    const tope = maximoBonito(maximo);

    // Geometria del SVG (viewBox 800 x 360).
    const vbW = 800;
    const vbH = 360;
    const margen = { arriba: 28, derecha: 18, abajo: 40, izquierda: 64 };
    const ancho = vbW - margen.izquierda - margen.derecha;
    const alto = vbH - margen.arriba - margen.abajo;

    const n = datos.length;
    const ranura = ancho / n;
    const anchoBarra = Math.min(ranura * 0.55, 64);

    const barras = datos.map((dato, i) => {
      const valor = Number(dato.ingreso) || 0;
      const h = (valor / tope) * alto;
      const x = margen.izquierda + ranura * i + (ranura - anchoBarra) / 2;
      const y = margen.arriba + alto - h;
      return {
        x,
        y,
        ancho: anchoBarra,
        alto: h,
        valor,
        periodo: dato.periodo,
        etiquetaX: margen.izquierda + ranura * i + ranura / 2,
      };
    });

    // Lineas de la escala Y (5 referencias).
    const lineas = Array.from({ length: 5 }, (_, i) => {
      const fraccion = i / 4;
      return {
        y: margen.arriba + alto - fraccion * alto,
        valor: tope * fraccion,
      };
    });

    // Rango de fechas mostrado (los datos vienen ordenados por periodo ascendente).
    const desde = datos[0].periodo;
    const hasta = datos[datos.length - 1].periodo;

    return { vbW, vbH, margen, barras, lineas, tope, desde, hasta };
  }, [datos]);

  if (cargando) {
    return (
      <div className="dt-grafica" aria-busy="true">
        <span className="dt-spinner" />
        <span>Cargando la grafica de ingresos…</span>
      </div>
    );
  }

  if (!geometria) {
    return (
      <div className="dt-grafica dt-grafica-vacia">
        <span>No hay datos de ventas completadas para mostrar la grafica.</span>
      </div>
    );
  }

  const { vbW, vbH, barras, lineas, desde, hasta } = geometria;

  const total = barras.reduce((s, b) => s + b.valor, 0);
  const rango = desde === hasta ? mesConAnio(desde) : `${mesConAnio(desde)} - ${mesConAnio(hasta)}`;

  return (
    <div className="dt-grafica">
      <div className="dt-grafica-encabezado">
        <div>
          <strong>Ingresos por mes</strong>
          <span>
            Datos de {rango}{" "}
            {total > 0 ? `· Total ${pesos(String(total))}` : ""}
          </span>
        </div>
      </div>

      <svg
        className="dt-grafica-svg"
        viewBox={`0 0 ${vbW} ${vbH}`}
        role="img"
        aria-label="Grafica de ingresos por mes"
      >
        {/* Lineas horizontales de la escala Y */}
        {lineas.map((linea, i) => (
          <g key={i}>
            <line
              x1={geometria.margen.izquierda}
              y1={linea.y}
              x2={vbW - geometria.margen.derecha}
              y2={linea.y}
              stroke={COLOR_LINEA}
              strokeWidth={1}
            />
            <text
              x={geometria.margen.izquierda - 10}
              y={linea.y + 4}
              textAnchor="end"
              fill={COLOR_TEXTO}
              fontSize={12}
            >
              {linea.valor > 0 ? `${linea.valor.toLocaleString("es-CO")}` : "0"}
            </text>
          </g>
        ))}

        {/* Barras */}
        {barras.map((barra) => (
          <g key={barra.periodo}>
            <rect
              x={barra.x}
              y={barra.y}
              width={barra.ancho}
              height={Math.max(barra.alto, 0)}
              rx={6}
              ry={6}
              fill={COLOR_BARRA}
            >
              <title>
                {`${barra.periodo}: ${pesos(String(barra.valor))}`}
              </title>
            </rect>
            {/* Etiqueta del valor encima de la barra */}
            {barra.valor > 0 && (
              <text
                x={barra.x + barra.ancho / 2}
                y={barra.y - 7}
                textAnchor="middle"
                fill={COLOR_TEXTO}
                fontSize={12}
                fontWeight={700}
              >
                {barra.valor.toLocaleString("es-CO", {
                  maximumFractionDigits: 0,
                })}
              </text>
            )}
            {/* Etiqueta del mes abajo */}
            <text
              x={barra.etiquetaX}
              y={vbH - 16}
              textAnchor="middle"
              fill={COLOR_TEXTO}
              fontSize={12}
              fontWeight={600}
            >
              {mesCorto(barra.periodo)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
