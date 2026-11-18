// src/pages/vendedor/ventas.tsx
//
// Ventas emitidas. No se crean a mano (nacen al entregar un pedido); solo se
// consultan y, si hay un error, se anulan.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, CreditCard, Eye, FileText, RefreshCw, Receipt, TrendingUp, X } from "../../components/iconos";

import { numero, pesos, traerTodo, ventas } from "../../services/api";
import { BotonesReportesAdmin } from "../../components/botones-reportes-admin";
import { resumirVentasPorMes } from "../../services/analitica-reportes";
import type { ReporteAdmin } from "../../services/reportes";
import { useSesion } from "../../context/sesion-contexto";
import logoNegro from "../../assets/images/logo negro.png";
import {
  Aviso,
  BarraListado,
  CajaBusqueda,
  EncabezadoModulo,
  EtiquetaEstado,
  FiltroEstado,
  FilaIndicadores,
  Indicador,
  TablaCargando,
  TablaVacia,
  fecha,
  tonoDeEstado,
} from "../../components/indicadores";
import GraficaIngresos from "../../components/grafica-ingresos";
import type { IngresoPorMes, Venta } from "../../types";

export default function VentasVendedor() {
  const { usuario, esAdministrador } = useSesion();

  const [lista, setLista] = useState<Venta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ingresos, setIngresos] = useState<IngresoPorMes[]>([]);
  const [graficaCargando, setGraficaCargando] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [detalle, setDetalle] = useState<Venta | null>(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const datos = await traerTodo((saltar, limite) => ventas.listar({ saltar, limite }));
      setLista(datos.items);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudieron cargar las ventas.");
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarGrafica = useCallback(async () => {
    setGraficaCargando(true);
    try {
      const datos = await ventas.ingresosPorMes();
      setIngresos(datos);
    } catch {
      setIngresos([]);
    } finally {
      setGraficaCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
    void cargarGrafica();
  }, [cargarDatos, cargarGrafica]);

  const resumen = useMemo(() => {
    const completadas = lista.filter((venta) => venta.estado === "Completada");

    return {
      total: lista.length,
      completadas: completadas.length,
      anuladas: lista.filter((venta) => venta.estado === "Anulada").length,
      recaudado: completadas.reduce((suma, venta) => suma + numero(venta.total_pagado), 0),
    };
  }, [lista]);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return lista.filter((venta) => {
      const coincideTexto =
        !texto ||
        String(venta.id_venta).includes(texto) ||
        String(venta.id_pedido_fk ?? "").includes(texto) ||
        String(venta.factura?.id_factura ?? "").includes(texto);

      const coincideEstado = !filtroEstado || venta.estado === filtroEstado;

      return coincideTexto && coincideEstado;
    });
  }, [lista, busqueda, filtroEstado]);

  const crearReporte = (): ReporteAdmin => ({
    modulo: "ventas",
    titulo: "Reporte de ventas",
    generado_por: usuario?.nombre ?? "Administrador",
    indicadores: [
      { etiqueta: "Ventas filtradas", valor: String(filtrados.length) },
      { etiqueta: "Completadas", valor: String(filtrados.filter((venta) => venta.estado === "Completada").length) },
      { etiqueta: "Anuladas", valor: String(filtrados.filter((venta) => venta.estado === "Anulada").length) },
      { etiqueta: "Ingresos completados", valor: pesos(filtrados.filter((venta) => venta.estado === "Completada").reduce((suma, venta) => suma + numero(venta.total_pagado), 0)) },
    ],
    columnas: [
      { clave: "id", titulo: "Venta" },
      { clave: "pedido", titulo: "Pedido" },
      { clave: "fecha", titulo: "Fecha" },
      { clave: "factura", titulo: "Factura" },
      { clave: "unidades", titulo: "Unidades" },
      { clave: "total_cop", titulo: "Total pagado COP" },
      { clave: "descuento_cop", titulo: "Descuento COP" },
      { clave: "estado", titulo: "Estado" },
    ],
    filas: filtrados.map((venta) => ({
      id: venta.id_venta,
      pedido: venta.id_pedido_fk,
      fecha: venta.fecha_venta,
      factura: venta.factura?.id_factura ?? null,
      unidades: venta.total_unidades,
      total_cop: numero(venta.total_pagado),
      descuento_cop: numero(venta.descuento_total),
      estado: venta.estado,
    })),
    grafica: resumirVentasPorMes(filtrados),
  });

  const anular = async (venta: Venta) => {
    const confirmado = window.confirm(
      `¿Anular la venta #${venta.id_venta}? La venta no se borra: queda marcada como Anulada.`
    );
    if (!confirmado) return;

    setGuardando(true);
    setError("");

    try {
      await ventas.anular(venta.id_venta);
      setMensaje(`Venta #${venta.id_venta} anulada.`);
      await cargarDatos();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo anular la venta.");
    } finally {
      setGuardando(false);
    }
  };

  const descargarVentaImprimible = (venta: Venta) => {
    const total = Number(venta.total_pagado ?? 0);
    const iva = Math.round(total * 0.19);
    const subtotal = Math.max(0, total - iva);
    const ventana = window.open("", "_blank", "width=820,height=900");
    if (!ventana) return;

    ventana.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Factura Venta #${venta.id_venta}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 36px; }
    .cabecera { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
    .empresa p, .meta p { margin: 2px 0; font-size: 13px; color: #475569; }
    .meta { text-align: right; }
    .meta h2 { margin: 0 0 4px; font-size: 18px; color: #0f172a; }
    .caja { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 18px; }
    .caja h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; color: #64748b; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; }
    th { background: #f8fafc; color: #475569; font-weight: 600; }
    .totales { margin-top: 18px; margin-left: auto; width: 280px; font-size: 14px; }
    .totales div { display: flex; justify-content: space-between; padding: 5px 0; }
    .totales .total { border-top: 2px solid #0f172a; margin-top: 6px; padding-top: 8px; font-size: 16px; font-weight: 700; }
    .pie { margin-top: 28px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    @media print { body { margin: 18px; } }
  </style>
</head>
<body>
  <div class="cabecera">
    <div class="empresa" style="display:flex;align-items:center;gap:12px;">
      <img src="${logoNegro}" alt="Dotaciones Toronto" style="width:48px;height:48px;object-fit:contain;border-radius:8px;flex-shrink:0;" />
      <div>
        <h1 style="margin:0 0 2px;font-size:20px;">DOTACIONES TORONTO S.A.S.</h1>
        <p style="margin:2px 0;font-size:12.5px;color:#475569;">NIT: 900123456-8 · Régimen Común</p>
        <p style="margin:2px 0;font-size:12.5px;color:#475569;">Dotaciones Empresariales e Industriales · Bogotá D.C.</p>
      </div>
    </div>
    <div class="meta">
      <h2>FACTURA DE VENTA #${venta.id_venta}</h2>
      <p>Fecha: ${fecha(venta.fecha_venta)}</p>
      <p>Estado: <strong>${venta.estado}</strong></p>
    </div>
  </div>

  <div class="caja">
    <h3>Información de la Venta</h3>
    <div class="grid">
      <div><strong>Pedido asociado:</strong> #${venta.id_pedido_fk}</div>
      <div><strong>Unidades:</strong> ${venta.total_unidades}</div>
      <div><strong>Factura electrónica:</strong> ${venta.numero_factura ?? "Sin factura"}</div>
      <div><strong>Estado:</strong> ${venta.estado}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Concepto</th>
        <th style="text-align:right">Unidades</th>
        <th style="text-align:right">Valor</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Venta de dotaciones empresariales (Pedido #${venta.id_pedido_fk})</td>
        <td style="text-align:right">${venta.total_unidades}</td>
        <td style="text-align:right">${pesos(subtotal)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totales">
    <div><span>Subtotal</span><span>${pesos(subtotal)}</span></div>
    <div><span>IVA (19%)</span><span>${pesos(iva)}</span></div>
    <div class="total"><span>Total pagado</span><span>${pesos(total)}</span></div>
  </div>

  <div class="pie">
    <p>Documento generado desde el módulo de Ventas · Dotaciones Toronto S.A.S.</p>
  </div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`);
    ventana.document.close();
  };

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Ventas"
        titulo="Ventas"
        descripcion="Cada pedido entregado genera su venta y su factura. Aquí se consultan y se anulan."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "vendedor" } : undefined}
        accion={
          <div className="dt-acciones-admin-encabezado">
            {esAdministrador && (
              <BotonesReportesAdmin crearReporte={crearReporte} alError={setError} deshabilitado={cargando} />
            )}
            <button
              type="button"
              className="dt-accion-principal"
              onClick={() => void cargarDatos()}
              disabled={cargando}
            >
              <RefreshCw size={15} className={cargando ? "dt-girando" : ""} />
              Actualizar
            </button>
          </div>
        }
      />

      {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}
      {mensaje && <Aviso tipo="exito" mensaje={mensaje} onCerrar={() => setMensaje("")} />}

      <FilaIndicadores>
        <Indicador etiqueta="Recaudado" valor={pesos(resumen.recaudado)} descripcion="Solo ventas completadas" icono={TrendingUp} tono="verde" cargando={cargando} />
        <Indicador etiqueta="Ventas" valor={resumen.total} descripcion="Registradas" icono={CreditCard} tono="azul" cargando={cargando} />
        <Indicador etiqueta="Completadas" valor={resumen.completadas} descripcion="Con factura vigente" icono={Receipt} tono="morado" cargando={cargando} />
        <Indicador etiqueta="Anuladas" valor={resumen.anuladas} descripcion="No cuentan en ingresos" icono={Ban} tono="rojo" cargando={cargando} />
      </FilaIndicadores>

      <div style={{ marginBottom: 22 }}>
        <GraficaIngresos datos={ingresos} cargando={graficaCargando} />
      </div>

      <section className="dt-listado">
        <BarraListado
          titulo="Listado de ventas"
          descripcion={`${filtrados.length} de ${lista.length} ventas`}
          Icono={Receipt}
        >
          <CajaBusqueda valor={busqueda} onCambio={setBusqueda} marcador="Venta, pedido o factura" />

          <FiltroEstado
            valor={filtroEstado}
            onCambio={setFiltroEstado}
            opciones={[
              { valor: "", texto: "Todos los estados" },
              { valor: "Completada", texto: "Completadas" },
              { valor: "Anulada", texto: "Anuladas" },
            ]}
          />

          <button
            type="button"
            className="dt-boton-icono"
            onClick={() => void cargarDatos()}
            disabled={cargando}
            title="Refrescar"
          >
            <RefreshCw size={15} className={cargando ? "dt-girando" : ""} />
          </button>
        </BarraListado>

        {cargando ? (
          <TablaCargando mensaje="Consultando las ventas…" />
        ) : filtrados.length === 0 ? (
          <TablaVacia
            titulo="No hay ventas"
            mensaje="Las ventas aparecen cuando un pedido se marca como Entregado."
            Icono={Receipt}
          />
        ) : (
          <div className="dt-tabla-scroll">
            <table className="dt-tabla">
              <thead>
                <tr>
                  <th>Venta</th>
                  <th>Fecha</th>
                  <th>Pedido</th>
                  <th>Factura</th>
                  <th>Total pagado</th>
                  <th>Estado</th>
                  <th className="dt-columna-acciones">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filtrados.map((venta) => (
                  <tr key={venta.id_venta}>
                    <td>
                      <span className="dt-fila-principal">Venta #{venta.id_venta}</span>
                      <span className="dt-fila-secundaria">
                        {venta.total_unidades} unidades
                      </span>
                    </td>

                    <td>{fecha(venta.fecha_venta)}</td>
                    <td>{venta.id_pedido_fk ? `#${venta.id_pedido_fk}` : "—"}</td>
                    <td>
                      <span className="dt-fila-secundaria">
                        {venta.factura ? `F-${venta.factura.id_factura}` : "Sin factura"}
                      </span>
                    </td>

                    <td>
                      <span className="dt-fila-principal">{pesos(venta.total_pagado)}</span>
                      {Number(venta.descuento_total) > 0 && (
                        <span className="dt-fila-secundaria">
                          Descuento {pesos(venta.descuento_total)}
                        </span>
                      )}
                    </td>

                    <td>
                      <EtiquetaEstado
                        tipo={tonoDeEstado(venta.estado)}
                        texto={venta.estado}
                      />
                    </td>

                    <td>
                      <div className="dt-acciones-fila">
                        <button
                          type="button"
                          className="dt-boton-icono"
                          title="Ver detalle"
                          onClick={() => setDetalle(venta)}
                        >
                          <Eye size={14} />
                        </button>

                        <button
                          type="button"
                          className="dt-boton-icono"
                          title="Descargar / Imprimir factura"
                          onClick={() => descargarVentaImprimible(venta)}
                        >
                          <FileText size={14} />
                        </button>

                        {venta.estado === "Completada" && (
                          <button
                            type="button"
                            className="dt-boton-icono dt-boton-peligro"
                            title="Anular venta"
                            disabled={guardando}
                            onClick={() => void anular(venta)}
                          >
                            <Ban size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detalle && (
        <div
          className="dt-modal-fondo"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setDetalle(null);
          }}
        >
          <section className="dt-modal" role="dialog" aria-modal="true">
            <header className="dt-modal-encabezado">
              <span className="dt-modal-icono">
                <FileText size={21} />
              </span>

              <div className="dt-modal-titulo-grupo">
                <span className="dt-migas">Venta</span>
                <h2>Venta #{detalle.id_venta}</h2>
                <p>
                  {fecha(detalle.fecha_venta)} · {detalle.estado}
                  {detalle.factura ? ` · Factura F-${detalle.factura.id_factura}` : ""}
                </p>
              </div>

              <button
                type="button"
                className="dt-boton-cerrar-modal"
                onClick={() => setDetalle(null)}
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </header>

            <div className="dt-formulario-contenido">
              <div className="dt-tabla-scroll">
                <table className="dt-tabla">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cant.</th>
                      <th>Precio</th>
                      <th>Devuelto</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>

                  <tbody>
                    {detalle.items.map((item) => (
                      <tr key={item.id_detalle_venta}>
                        <td>{item.nombre_producto ?? `Producto ${item.id_producto}`}</td>
                        <td>{item.cantidad}</td>
                        <td>{pesos(item.precio_unitario)}</td>
                        <td>{item.cantidad_devuelta}</td>
                        <td>{pesos(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="dt-listado-contexto" style={{ marginTop: 12, borderRadius: 10 }}>
                <span>
                  <span className="dt-punto-contexto" />
                  Total pagado
                </span>
                <strong>{pesos(detalle.total_pagado)}</strong>
              </div>
            </div>

            <footer className="dt-modal-acciones">
              <button
                type="button"
                className="dt-boton-secundario"
                onClick={() => setDetalle(null)}
              >
                Cerrar
              </button>

              <button
                type="button"
                className="dt-accion-principal"
                onClick={() => descargarVentaImprimible(detalle)}
              >
                <FileText size={15} />
                Descargar / Imprimir PDF
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
