// src/pages/vendedor/reportes-vendedor.tsx
//
// "Reportes": el modulo de reportes del VENDEDOR.
//
// Contiene:
//  - Filtros por fechas y estado.
//  - Cantidad de productos vendidos, total de ventas e ingresos.
//  - Metodos de pago utilizados.
//  - Historial de transacciones.
//  - Descarga en PDF (vista de impresion corporativa con datos de la
//    empresa y logo) y en Excel (.xlsx generado por el backend).

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  Package,
  Receipt,
  RefreshCw,
  TrendingUp,
} from "../../components/iconos";
import { BASE_URL, aQuery, pesos, ventas } from "../../services/api";
import { useSesion } from "../../context/sesion-contexto";
import {
  Aviso,
  BarraListado,
  EncabezadoModulo,
  EtiquetaEstado,
  FilaIndicadores,
  Indicador,
  TablaCargando,
  TablaVacia,
  fecha,
  tonoDeEstado,
} from "../../components/indicadores";
import type { ReporteVendedor } from "../../types";

interface FiltrosReporte {
  fecha_desde: string;
  fecha_hasta: string;
  estado: string; // "" = todas, "Completada", "Anulada"
}

const LOGO_URL = `${window.location.origin}/logo.png`;

export default function ReportesVendedor() {
  const { usuario } = useSesion();

  const [filtros, setFiltros] = useState<FiltrosReporte>({
    fecha_desde: "",
    fecha_hasta: "",
    estado: "",
  });

  const [reporte, setReporte] = useState<ReporteVendedor | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const datos = await ventas.reporteVendedor({
        fecha_desde: filtros.fecha_desde || undefined,
        fecha_hasta: filtros.fecha_hasta || undefined,
        estado: filtros.estado || undefined,
      });
      setReporte(datos);
    } catch (fallo) {
      // Si el servidor no responde (network error), dar una pista clara.
      const mensaje =
        fallo instanceof Error && /Failed to fetch|TypeError/i.test(fallo.message)
          ? "No se pudo conectar con el backend. Verifica que uvicorn esté corriendo en http://localhost:8000"
          : fallo instanceof Error
            ? fallo.message
            : "No se pudo cargar el reporte.";
      setError(mensaje);
    } finally {
      setCargando(false);
    }
  }, [filtros]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const aplicarFiltros = () => {
    setMensaje("");
    void cargar();
  };

  const limpiarFiltros = () => {
    setFiltros({ fecha_desde: "", fecha_hasta: "", estado: "" });
  };

  // --- Descargar Excel (.xlsx generado por el backend) -------------------
  const descargarExcel = async () => {
    setMensaje("");
    setError("");

    try {
      const token = localStorage.getItem("token");
      const respuesta = await fetch(
        `${BASE_URL}/ventas/reportes/vendedor/excel${aQuery({
          fecha_desde: filtros.fecha_desde || undefined,
          fecha_hasta: filtros.fecha_hasta || undefined,
          estado: filtros.estado || undefined,
        })}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (!respuesta.ok) {
        let detalle = `Error ${respuesta.status}`;
        try {
          const datos = await respuesta.json();
          if (typeof datos?.detalle === "string") detalle = datos.detalle;
          else if (typeof datos?.detail === "string") detalle = datos.detail;
        } catch {
          /* la respuesta no trae JSON */
        }
        throw new Error(detalle);
      }

      const blob = await respuesta.blob();
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = "reporte-ventas-vendedor.xlsx";
      enlace.click();
      URL.revokeObjectURL(url);

      setMensaje("Excel descargado.");
    } catch (fallo) {
      // Si el servidor no responde (network error), dar una pista clara.
      const mensaje =
        fallo instanceof Error && /Failed to fetch|TypeError/i.test(fallo.message)
          ? "No se pudo conectar con el backend para descargar el Excel. Verifica que uvicorn esté corriendo en http://localhost:8000"
          : fallo instanceof Error
            ? fallo.message
            : "No se pudo descargar el Excel.";
      setError(mensaje);
    }
  };

  // --- Descargar PDF (vista de impresión corporativa) ---------------------
  const exportarPDF = () => {
    if (!reporte) return;

    const empresa = reporte.empresa;
    const metodos = reporte.metodos_pago;
    const transacciones = reporte.transacciones;

    const filasTransacciones = transacciones
      .map(
        (t) => `
        <tr>
          <td>${t.id_venta}</td>
          <td>${fecha(t.fecha_venta)}</td>
          <td>${t.cliente}</td>
          <td>${t.total_unidades}</td>
          <td>${pesos(t.total_pagado)}</td>
          <td>${t.estado}</td>
          <td>${t.metodo_pago || "Sin especificar"}</td>
        </tr>`
      )
      .join("");

    const filasMetodos = metodos
      .map(
        (m) => `
        <tr>
          <td>${m.metodo}</td>
          <td>${pesos(m.ingreso)}</td>
          <td>${m.ventas}</td>
        </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Reporte de Ventas - ${empresa.nombre_comercial}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    color: #0f172a;
    margin: 40px;
    font-size: 13px;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    border-bottom: 3px solid #fa813b;
    padding-bottom: 16px;
    margin-bottom: 18px;
  }
  .header img { width: 64px; height: auto; }
  .header h1 { margin: 0; font-size: 20px; color: #0f172a; }
  .header p { margin: 4px 0 0; color: #64748b; font-size: 12px; }
  .datos { margin-left: auto; text-align: right; font-size: 11.5px; color: #475569; line-height: 1.6; }
  h2 {
    color: #fa813b;
    font-size: 14px;
    margin: 22px 0 8px;
    border-left: 4px solid #fa813b;
    padding-left: 8px;
  }
  .resumen { display: flex; gap: 14px; margin-bottom: 6px; }
  .card {
    flex: 1;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px 16px;
    background: #ffffff;
  }
  .card span { display: block; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .card strong { display: block; font-size: 20px; color: #0f172a; margin-top: 4px; }
  .filtros {
    background: #fff1e8;
    border: 1px solid #fed7aa;
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 12px;
    color: #9a3412;
    margin-bottom: 6px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 6px;
  }
  th, td {
    border: 1px solid #e2e8f0;
    padding: 7px 10px;
    text-align: left;
    font-size: 12px;
  }
  th { background: #fff1e8; color: #9a3412; font-weight: 700; }
  td { color: #1e293b; }
  .pie {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
    color: #94a3b8;
    font-size: 11px;
  }
  .nulo { color: #94a3b8; font-style: italic; }
</style>
</head>
<body>
  <div class="header">
    <img src="${LOGO_URL}" alt="Logo ${empresa.nombre_comercial}" />
    <div>
      <h1>${empresa.nombre_comercial}</h1>
      <p>${empresa.razon_social}</p>
    </div>
    <div class="datos">
      NIT ${empresa.nit}${empresa.dv ? "-" + empresa.dv : ""}<br />
      ${empresa.direccion}<br />
      ${empresa.telefono}<br />
      ${empresa.correo}
    </div>
  </div>

  <h2>Reporte de Ventas del Vendedor</h2>
  <div class="filtros">
    Filtros: desde ${reporte.filtros.fecha_desde || "—"} ·
    hasta ${reporte.filtros.fecha_hasta || "—"} ·
    estado: ${reporte.filtros.estado || "Todas"}
  </div>

  <h2>Resumen</h2>
  <div class="resumen">
    <div class="card"><span>Cantidad de productos vendidos</span><strong>${reporte.resumen.total_unidades}</strong></div>
    <div class="card"><span>Total de ventas</span><strong>${reporte.resumen.ventas}</strong></div>
    <div class="card"><span>Total de ingresos</span><strong>${pesos(reporte.resumen.total_ingresos)}</strong></div>
  </div>

  <h2>Metodos de pago utilizados</h2>
  ${
    metodos.length === 0
      ? '<p class="nulo">No hay metodos de pago registrados.</p>'
      : `<table>
      <thead><tr><th>Metodo de pago</th><th>Ingreso</th><th>Ventas</th></tr></thead>
      <tbody>${filasMetodos}</tbody>
    </table>`
  }

  <h2>Historial de transacciones</h2>
  ${
    transacciones.length === 0
      ? '<p class="nulo">No hay transacciones en el periodo seleccionado.</p>'
      : `<table>
      <thead>
        <tr>
          <th>ID Venta</th><th>Fecha</th><th>Cliente</th>
          <th>Unidades</th><th>Total</th><th>Estado</th><th>Metodo de pago</th>
        </tr>
      </thead>
      <tbody>${filasTransacciones}</tbody>
    </table>`
  }

  <div class="pie">
    Reporte generado el ${new Date().toLocaleString()} por
    ${usuario?.nombre ?? "vendedor"} · ${empresa.nombre_comercial}
  </div>
</body>
</html>`;

    const ventana = window.open("", "_blank", "width=1000,height=800");
    if (!ventana) {
      setError("Por favor permite las ventanas emergentes para generar el reporte PDF.");
      return;
    }

    ventana.document.write(html);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => {
      ventana.print();
    }, 300);
  };

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Ventas"
        titulo="Reportes"
        descripcion="Cantidad de productos vendidos, total de ventas, métodos de pago e historial de transacciones. Con filtros por fecha y estado, en PDF y Excel."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "vendedor" } : undefined}
        accion={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="dt-boton-secundario"
              onClick={() => void descargarExcel()}
              disabled={!reporte}
            >
              <Receipt size={15} />
              Excel
            </button>
            <button
              type="button"
              className="dt-accion-principal"
              onClick={exportarPDF}
              disabled={!reporte}
            >
              <FileText size={15} />
              Descargar PDF
            </button>
          </div>
        }
      />

      {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}
      {mensaje && <Aviso tipo="exito" mensaje={mensaje} onCerrar={() => setMensaje("")} />}

      {/* Filtros */}
      <div className="dt-listado" style={{ marginBottom: 18 }}>
        <BarraListado
          titulo="Filtros del reporte"
          descripcion="Aplica sobre qué ventas se muestran y se exportan"
          Icono={ClipboardList}
        >
          <div className="dt-formulario-contenido" style={{ padding: "10px 14px 4px" }}>
            <div className="dt-formulario-grid">
              <label>
                Fecha desde
                <input
                  type="date"
                  value={filtros.fecha_desde}
                  onChange={(e) =>
                    setFiltros({ ...filtros, fecha_desde: e.target.value })
                  }
                />
              </label>

              <label>
                Fecha hasta
                <input
                  type="date"
                  value={filtros.fecha_hasta}
                  onChange={(e) =>
                    setFiltros({ ...filtros, fecha_hasta: e.target.value })
                  }
                />
              </label>

              <label>
                Estado
                <select
                  value={filtros.estado}
                  onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
                >
                  <option value="">Todas</option>
                  <option value="Completada">Completada</option>
                  <option value="Anulada">Anulada</option>
                </select>
              </label>

              <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="dt-accion-principal"
                  onClick={aplicarFiltros}
                  disabled={cargando}
                >
                  <TrendingUp size={14} />
                  Aplicar
                </button>
                <button
                  type="button"
                  className="dt-boton-secundario"
                  onClick={limpiarFiltros}
                  disabled={cargando}
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        </BarraListado>
      </div>

      {cargando ? (
        <TablaCargando mensaje="Cargando el reporte…" />
      ) : !reporte ? (
        <TablaVacia
          titulo="No se pudo cargar el reporte"
          mensaje="Revisa la conexión con el backend y vuelve a intentarlo."
          Icono={FileText}
        />
      ) : (
        <>
          <FilaIndicadores>
            <Indicador
              etiqueta="Cantidad de productos vendidos"
              valor={reporte.resumen.total_unidades}
              descripcion="Unidades en el periodo"
              icono={Package}
              tono="verde"
            />
            <Indicador
              etiqueta="Total de ventas"
              valor={reporte.resumen.ventas}
              descripcion="Transacciones en el periodo"
              icono={CheckCircle2}
              tono="azul"
            />
            <Indicador
              etiqueta="Total de ingresos"
              valor={pesos(reporte.resumen.total_ingresos)}
              descripcion="Suma de las ventas"
              icono={CreditCard}
              tono="verde"
            />
            <Indicador
              etiqueta="Métodos de pago"
              valor={reporte.metodos_pago.length}
              descripcion="Formas de pago utilizadas"
              icono={ArrowLeftRight}
              tono="ambar"
            />
          </FilaIndicadores>

          <div className="dt-grid-dashboard" style={{ marginTop: 18 }}>
            {/* Metodos de pago */}
            <section className="dt-panel">
              <div className="dt-panel-encabezado">
                <ArrowLeftRight size={17} />
                <div>
                  <h2>Métodos de pago utilizados</h2>
                  <p>Desglose del ingreso por forma de pago</p>
                </div>
              </div>
              <div className="dt-panel-cuerpo">
                {reporte.metodos_pago.length === 0 ? (
                  <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
                    No hay métodos de pago registrados en este periodo.
                  </p>
                ) : (
                  <div className="dt-lista-actividad">
                    {reporte.metodos_pago.map((metodo) => (
                      <div key={metodo.metodo} className="dt-actividad">
                        <span
                          className="dt-avatar-fila"
                          style={{ background: "linear-gradient(150deg, #fa813b, #e06a28)" }}
                        >
                          <ArrowLeftRight size={15} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ display: "block" }}>{metodo.metodo}</strong>
                          <span style={{ display: "block", fontSize: "0.82rem", color: "#64748b" }}>
                            {metodo.ventas} ventas
                          </span>
                        </div>
                        <span className="dt-actividad-valor" style={{ color: "#e06a28" }}>
                          {pesos(metodo.ingreso)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Resumen extra */}
            <section className="dt-panel">
              <div className="dt-panel-encabezado">
                <TrendingUp size={17} />
                <div>
                  <h2>Resumen ejecutivo</h2>
                  <p>Indicadores clave del periodo</p>
                </div>
              </div>
              <div className="dt-panel-cuerpo">
                <div className="dt-lista-actividad">
                  <div className="dt-actividad">
                    <span className="dt-avatar-fila" style={{ background: "linear-gradient(150deg, #10b981, #059669)" }}>
                      <Package size={15} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: "block" }}>Cantidad de productos vendidos</strong>
                      <span style={{ display: "block", fontSize: "0.82rem", color: "#64748b" }}>
                        Unidades totales
                      </span>
                    </div>
                    <span className="dt-actividad-valor" style={{ color: "#059669" }}>
                      {reporte.resumen.total_unidades}
                    </span>
                  </div>
                  <div className="dt-actividad">
                    <span className="dt-avatar-fila" style={{ background: "linear-gradient(150deg, #3b82f6, #1d4ed8)" }}>
                      <CheckCircle2 size={15} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: "block" }}>Total de ventas</strong>
                      <span style={{ display: "block", fontSize: "0.82rem", color: "#64748b" }}>
                        Transacciones en el periodo
                      </span>
                    </div>
                    <span className="dt-actividad-valor">{reporte.resumen.ventas}</span>
                  </div>
                  <div className="dt-actividad">
                    <span className="dt-avatar-fila" style={{ background: "linear-gradient(150deg, #10b981, #047857)" }}>
                      <CreditCard size={15} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: "block" }}>Total de ingresos</strong>
                      <span style={{ display: "block", fontSize: "0.82rem", color: "#64748b" }}>
                        Suma de ventas
                      </span>
                    </div>
                    <span className="dt-actividad-valor" style={{ color: "#047857" }}>
                      {pesos(reporte.resumen.total_ingresos)}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Historial de transacciones */}
          <div className="dt-listado" style={{ marginTop: 18 }}>
            <BarraListado
              titulo="Historial de transacciones"
              descripcion="Todas las ventas del periodo seleccionado"
              Icono={FileText}
            >
              <button
                type="button"
                className="dt-boton-icono"
                onClick={() => void cargar()}
                disabled={cargando}
                title="Refrescar"
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  display: "inline-grid",
                  placeItems: "center",
                }}
              >
                <RefreshCw size={14} className={cargando ? "dt-girando" : ""} />
              </button>
            </BarraListado>

            {reporte.transacciones.length === 0 ? (
              <TablaVacia
                titulo="Sin transacciones"
                mensaje="No hay ventas en el periodo y estado seleccionados."
                Icono={FileText}
              />
            ) : (
              <div className="dt-tabla-scroll">
                <table className="dt-tabla">
                  <thead>
                    <tr>
                      <th>ID Venta</th>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Unidades</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>Método de pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporte.transacciones.map((t) => (
                      <tr key={t.id_venta}>
                        <td>
                          <span className="dt-fila-principal">Venta #{t.id_venta}</span>
                        </td>
                        <td>{fecha(t.fecha_venta)}</td>
                        <td>{t.cliente}</td>
                        <td>{t.total_unidades}</td>
                        <td>
                          <span className="dt-fila-principal">{pesos(t.total_pagado)}</span>
                        </td>
                        <td>
                          <EtiquetaEstado tipo={tonoDeEstado(t.estado ?? "")} texto={t.estado} />
                        </td>
                        <td>
                          <span className="dt-fila-secundaria">
                            {t.metodo_pago || "Sin especificar"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
