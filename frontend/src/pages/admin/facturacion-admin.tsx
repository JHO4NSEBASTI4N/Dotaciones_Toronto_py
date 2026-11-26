// src/pages/admin/facturacion-admin.tsx
//
// facturacion_admin.html del proyecto Java.
// Facturas electrónicas (DIAN): listar, firmar, enviar, consultar estado,
// anular y descargar el XML y la representación gráfica PDF del mismo documento.
// La emisión actual es simulada, aunque conserva el flujo y los artefactos.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Eye,
  FileText,
  RefreshCw,
  Send,
  ShieldCheck,
  TriangleAlert,
  X,
} from "../../components/iconos";
import { BASE_URL, facturas, pesos, traerTodo, ventas } from "../../services/api";
import { abrirFacturaImprimible } from "../../utils/factura-imprimible";
import { BotonesReportesAdmin } from "../../components/botones-reportes-admin";
import { contarPorCategoria } from "../../services/analitica-reportes";
import type { ReporteAdmin } from "../../services/reportes";
import { useSesion } from "../../context/sesion-contexto";
import logoBlanco from "../../assets/images/logo negro.png";
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
import type { FacturaElectronica } from "../../facturacion/entity/FacturaElectronica";

export default function FacturacionAdmin() {
  const { usuario } = useSesion();

  const [lista, setLista] = useState<FacturaElectronica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<number | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [detalle, setDetalle] = useState<FacturaElectronica | null>(null);
  const [xml, setXml] = useState("");

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const datos = await traerTodo((saltar, limite) => facturas.listar(saltar, limite));
      setLista(datos.items);
    } catch (fallo) {
      setError(
        fallo instanceof Error ? fallo.message : "No se pudieron cargar las facturas."
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const resumen = useMemo(
    () => ({
      total: lista.length,
      firmadas: lista.filter((f) => f.firmado).length,
      aceptadas: lista.filter((f) => f.estado_dian === "ACEPTADA").length,
      pendientes: lista.filter((f) => !f.fecha_envio).length,
    }),
    [lista]
  );

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return lista.filter((factura) => {
      const coincideTexto =
        !texto ||
        (factura.numero_factura ?? "").toLowerCase().includes(texto) ||
        (factura.razon_social_adquirente ?? "").toLowerCase().includes(texto) ||
        (factura.cufe ?? "").toLowerCase().includes(texto);

      const coincideEstado =
        !filtroEstado ||
        (filtroEstado === "firmadas" && factura.firmado) ||
        (filtroEstado === "sin-firmar" && !factura.firmado) ||
        (filtroEstado === "aceptadas" && factura.estado_dian === "ACEPTADA") ||
        (filtroEstado === "rechazadas" && factura.estado_dian === "RECHAZADA");

      return coincideTexto && coincideEstado;
    });
  }, [lista, busqueda, filtroEstado]);

  const crearReporte = (): ReporteAdmin => ({
    modulo: "facturacion",
    titulo: "Reporte de facturación electrónica",
    generado_por: usuario?.nombre ?? "Administrador",
    indicadores: [
      { etiqueta: "Facturas filtradas", valor: String(filtradas.length) },
      { etiqueta: "Firmadas", valor: String(filtradas.filter((f) => f.firmado).length) },
      { etiqueta: "Aceptadas DIAN", valor: String(filtradas.filter((f) => f.estado_dian === "ACEPTADA").length) },
      { etiqueta: "Total facturado", valor: pesos(filtradas.reduce((suma, f) => suma + Number(f.total_factura ?? 0), 0)) },
    ],
    columnas: [
      { clave: "id", titulo: "ID" },
      { clave: "numero", titulo: "Número" },
      { clave: "fecha", titulo: "Emisión" },
      { clave: "cliente", titulo: "Cliente" },
      { clave: "nit", titulo: "NIT" },
      { clave: "venta", titulo: "Venta" },
      { clave: "total_cop", titulo: "Total COP" },
      { clave: "estado_dian", titulo: "Estado DIAN" },
      { clave: "firma", titulo: "Firma" },
      { clave: "simulada", titulo: "Simulada" },
    ],
    filas: filtradas.map((factura) => ({
      id: factura.id_factura,
      numero: factura.numero_factura,
      fecha: factura.fecha_emision,
      cliente: factura.razon_social_adquirente,
      nit: factura.nit_adquirente,
      venta: factura.id_venta_fk,
      total_cop: factura.total_factura ?? 0,
      estado_dian: factura.estado_dian ?? "Sin respuesta",
      firma: factura.firmado ? "Firmada" : "Sin firmar",
      simulada: factura.simulado ? "Sí" : "No",
    })),
    grafica: contarPorCategoria(
      filtradas.map((f) => f.estado_dian || (f.firmado ? "Firmada sin respuesta" : "Sin firmar")),
      "Facturas por estado DIAN y firma"
    ),
  });

  const ejecutar = async (
    factura: FacturaElectronica,
    accion: "firmar" | "enviar" | "consultar" | "anular"
  ) => {
    const textos = {
      firmar: `¿Firmar digitalmente la factura ${factura.numero_factura}?`,
      enviar: `¿Enviar la factura ${factura.numero_factura} a la DIAN?`,
      consultar: `¿Consultar el estado de ${factura.numero_factura} en la DIAN?`,
      anular: `¿Anular la factura ${factura.numero_factura}? No se borra: queda anulada.`,
    };

    if (!window.confirm(textos[accion])) return;

    setGuardando(factura.id_factura);
    setError("");

    try {
      if (accion === "firmar") await facturas.firmar(factura.id_factura);
      if (accion === "enviar") await facturas.enviar(factura.id_factura);
      if (accion === "consultar") await facturas.consultarEstado(factura.id_factura);
      if (accion === "anular") await facturas.anular(factura.id_factura);

      const hechos = {
        firmar: "firmada",
        enviar: "enviada a la DIAN",
        consultar: "consultada",
        anular: "anulada",
      };
      setMensaje(`Factura ${factura.numero_factura} ${hechos[accion]}.`);
      await cargarDatos();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo completar la acción.");
    } finally {
      setGuardando(null);
    }
  };

  const abrirDetalle = async (factura: FacturaElectronica) => {
    setDetalle(factura);
    setXml("");
    setCargandoDetalle(true);

    try {
      const completa = await facturas.obtener(factura.id_factura);
      setDetalle(completa);
    } catch (fallo) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo cargar el detalle de los productos facturados."
      );
    }

    try {
      const respuesta = await facturas.xml(factura.id_factura);
      setXml(respuesta.xml);
    } catch {
      setXml("");
    } finally {
      setCargandoDetalle(false);
    }
  };

  const descargarXml = () => {
    if (!xml || !detalle) return;

    const archivo = new Blob([xml], { type: "application/xml" });
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = `${detalle.numero_factura}.xml`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  };

  const descargarRepresentacionDian = async (resumenFactura: FacturaElectronica) => {
    // Reservar la ventana durante el clic del usuario para evitar el bloqueo
    // del navegador mientras se consultan la factura y su venta asociada.
    const ventana = window.open("", "_blank", "width=960,height=900");
    if (!ventana) return;
    ventana.document.write("<p style='font-family:Arial;padding:24px'>Preparando factura…</p>");

    try {
      const factura = await facturas.obtener(resumenFactura.id_factura);
      const venta = factura.id_venta_fk
        ? await ventas.obtener(factura.id_venta_fk)
        : null;

      let qrDataUrl: string | undefined;
      if (factura.qr_url) {
        const token = localStorage.getItem("token");
        const respuestaQr = await fetch(
          `${BASE_URL}/facturas-electronicas/${factura.id_factura}/qr.svg`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (respuestaQr.ok) {
          const svg = await respuestaQr.text();
          qrDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        }
      }

      const idPedido = factura.id_pedido_fk ?? venta?.id_pedido_fk ?? null;
      const lineasVenta = venta?.items?.length
        ? venta.items.map((item) => ({
            nombre: item.nombre_producto,
            idProducto: item.id_producto,
            cantidad: item.cantidad,
            precioLista: item.precio_lista,
            descuentoUnitario: item.descuento_unitario,
            precioUnitario: item.precio_unitario,
            subtotal: item.subtotal,
          }))
        : (factura.lineas ?? []).map((linea) => {
            const cantidad = Number(linea.cantidad) || 0;
            const descuentoUnitario = cantidad
              ? Number(linea.descuento ?? 0) / cantidad
              : 0;
            return {
              nombre: linea.descripcion,
              idProducto: linea.codigo_producto ? Number(linea.codigo_producto) : null,
              cantidad,
              precioLista: Number(linea.precio_unitario ?? 0) + descuentoUnitario,
              descuentoUnitario,
              precioUnitario: linea.precio_unitario ?? 0,
              subtotal: Number(linea.total_linea ?? 0) + Number(linea.iva_valor ?? 0),
            };
          });

      abrirFacturaImprimible({
        logoUrl: logoBlanco,
        titulo: `FACTURA DE VENTA · PEDIDO #${idPedido ?? factura.id_venta_fk ?? factura.id_factura}`,
        fecha: fecha(factura.fecha_emision),
        estado: factura.estado_dian ?? factura.estado ?? "Pendiente",
        cliente: factura.razon_social_adquirente ?? "Cliente",
        correo:
          (factura as FacturaElectronica & { correo_adquirente?: string | null })
            .correo_adquirente ?? "—",
        idPedido,
        unidades: venta?.total_unidades ?? lineasVenta.reduce((total, linea) => total + linea.cantidad, 0),
        subtotalLista: venta?.subtotal_lista ?? factura.valor_bruto ?? 0,
        descuentoTotal: venta?.descuento_total ?? factura.descuento_total ?? 0,
        total: factura.total_factura ?? venta?.total_pagado ?? 0,
        lineas: lineasVenta,
        informacionDian: {
          numeroFactura: factura.numero_factura,
          cufe: factura.cufe,
          estado: factura.estado_dian ?? factura.estado,
          qrDataUrl,
          simulada: factura.simulado,
        },
      }, ventana);
    } catch (fallo) {
      ventana.close();
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo abrir la representación gráfica DIAN."
      );
    }
  };

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Administración"
        titulo="Facturación electrónica"
        descripcion="Al entregar un pedido se crea automáticamente el borrador DIAN. En modo simulado se asigna numeración SIM si falta resolución; para emisión fiscal real debes configurar la resolución DIAN oficial. La conexión actual es simulada."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "admin" } : undefined}
        accion={
          <div className="dt-acciones-admin-encabezado">
            <BotonesReportesAdmin crearReporte={crearReporte} alError={setError} deshabilitado={cargando} />
            <Link to="/admin/facturacion/config" className="dt-boton-secundario">
              <ShieldCheck size={14} /> Resoluciones
            </Link>
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
        <Indicador etiqueta="Facturas" valor={resumen.total} descripcion="Emitidas por ventas" icono={FileText} tono="azul" cargando={cargando} />
        <Indicador etiqueta="Firmadas" valor={resumen.firmadas} descripcion="Con firma digital" icono={ShieldCheck} tono="morado" cargando={cargando} />
        <Indicador etiqueta="Aceptadas" valor={resumen.aceptadas} descripcion="Respuesta de la DIAN" icono={CheckCircle2} tono="verde" cargando={cargando} />
        <Indicador etiqueta="Sin enviar" valor={resumen.pendientes} descripcion="Falta el envío" icono={TriangleAlert} tono="ambar" cargando={cargando} />
      </FilaIndicadores>

      <section className="dt-listado">
        <BarraListado
          titulo="Facturas electrónicas"
          descripcion={`${filtradas.length} de ${lista.length} facturas`}
          Icono={FileText}
        >
          <CajaBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            marcador="Número, cliente o CUFE"
          />

          <FiltroEstado
            valor={filtroEstado}
            onCambio={setFiltroEstado}
            opciones={[
              { valor: "", texto: "Todas" },
              { valor: "firmadas", texto: "Firmadas" },
              { valor: "sin-firmar", texto: "Sin firmar" },
              { valor: "aceptadas", texto: "Aceptadas DIAN" },
              { valor: "rechazadas", texto: "Rechazadas" },
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
          <TablaCargando mensaje="Consultando las facturas…" />
        ) : filtradas.length === 0 ? (
          <TablaVacia
            titulo="No hay facturas"
            mensaje="El PDF y el XML se descargan del mismo registro de factura electrónica DIAN. La factura convencional de Ventas es un comprobante distinto. Los pedidos nuevos generan su borrador automáticamente al entregarse."
            Icono={FileText}
          />
        ) : (
          <div className="dt-tabla-scroll">
            <table className="dt-tabla">
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Cliente</th>
                  <th>Emisión</th>
                  <th>Total</th>
                  <th>DIAN</th>
                  <th>Firma</th>
                  <th className="dt-columna-acciones">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filtradas.map((factura) => (
                  <tr key={factura.id_factura}>
                    <td>
                      <span className="dt-fila-principal">{factura.numero_factura}</span>
                      <span className="dt-fila-secundaria">
                        Venta #{factura.id_venta_fk ?? "—"}
                        {factura.simulado ? " · simulada" : ""}
                      </span>
                    </td>

                    <td>
                      <span className="dt-fila-principal">
                        {factura.razon_social_adquirente ?? "Consumidor final"}
                      </span>
                      <span className="dt-fila-secundaria">
                        NIT {factura.nit_adquirente ?? "—"}
                      </span>
                    </td>

                    <td>{fecha(factura.fecha_emision)}</td>

                    <td>
                      <span className="dt-fila-principal">
                        {pesos(factura.total_factura ?? 0)}
                      </span>
                      <span className="dt-fila-secundaria">
                        IVA {pesos(factura.total_iva ?? 0)}
                      </span>
                    </td>

                    <td>
                      <EtiquetaEstado
                        tipo={tonoDeEstado(factura.estado_dian ?? "pendiente")}
                        texto={factura.estado_dian ?? "Pendiente"}
                      />
                    </td>

                    <td>
                      <EtiquetaEstado
                        tipo={factura.firmado ? "activo" : "pendiente"}
                        texto={factura.firmado ? "Firmada" : "Sin firmar"}
                      />
                    </td>

                    <td>
                      <div className="dt-acciones-fila">
                        <button
                          type="button"
                          className="dt-boton-icono"
                          title="Ver factura"
                          onClick={() => void abrirDetalle(factura)}
                        >
                          <Eye size={14} />
                        </button>

                        <button
                          type="button"
                          className="dt-boton-icono"
                          title="Imprimir o guardar PDF con el formato de Ventas"
                          onClick={() => void descargarRepresentacionDian(factura)}
                        >
                          <FileText size={14} />
                        </button>

                        {!factura.firmado && (
                          <button
                            type="button"
                            className="dt-boton-icono"
                            title="Firmar"
                            disabled={guardando === factura.id_factura}
                            onClick={() => void ejecutar(factura, "firmar")}
                          >
                            <ShieldCheck size={14} />
                          </button>
                        )}

                        {factura.firmado && !factura.fecha_envio && (
                          <button
                            type="button"
                            className="dt-boton-icono"
                            title="Enviar a la DIAN"
                            disabled={guardando === factura.id_factura}
                            onClick={() => void ejecutar(factura, "enviar")}
                          >
                            <Send size={14} />
                          </button>
                        )}

                        {factura.fecha_envio && (
                          <button
                            type="button"
                            className="dt-boton-icono"
                            title="Consultar estado"
                            disabled={guardando === factura.id_factura}
                            onClick={() => void ejecutar(factura, "consultar")}
                          >
                            <RefreshCw size={14} />
                          </button>
                        )}

                        {factura.estado_dian !== "ANULADA" && (
                          <button
                            type="button"
                            className="dt-boton-icono dt-boton-peligro"
                            title="Anular"
                            disabled={guardando === factura.id_factura}
                            onClick={() => void ejecutar(factura, "anular")}
                          >
                            <X size={14} />
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
                <span className="dt-migas">Factura electrónica</span>
                <h2>{detalle.numero_factura}</h2>
                <p>
                  {fecha(detalle.fecha_emision)} · {detalle.estado_dian ?? "Pendiente"}
                  {detalle.simulado ? " · emisión simulada" : ""}
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
              <div
                style={{
                  border: "1px solid var(--dt-borde)",
                  borderRadius: 12,
                  padding: 18,
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 12,
                    borderBottom: "2px solid #0f172a",
                    paddingBottom: 12,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img
                      src={logoBlanco}
                      alt="Dotaciones Toronto"
                      style={{
                        width: 44,
                        height: 44,
                        objectFit: "contain",
                        borderRadius: 8,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <strong style={{ fontSize: 15.5, display: "block" }}>
                        {detalle.razon_social_emisor ?? "DOTACIONES TORONTO S.A.S."}
                      </strong>
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        NIT: {detalle.nit_emisor ?? "900123456-8"} · Dotaciones Empresariales
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ fontSize: 16, color: "#0f172a", display: "block" }}>
                      {detalle.numero_factura}
                    </strong>
                    <span style={{ fontSize: 12.5, color: "#64748b" }}>
                      {fecha(detalle.fecha_emision)} · {detalle.estado_dian ?? "PENDIENTE"}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                    fontSize: 13,
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: 11.5 }}>Cliente / Adquirente</span>
                    <strong>{detalle.razon_social_adquirente ?? "—"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: 11.5 }}>NIT / Documento</span>
                    <strong>{detalle.nit_adquirente ?? "—"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: 11.5 }}>Subtotal</span>
                    <strong>
                      {pesos(detalle.valor_bruto ?? Math.max(0, Number(detalle.total_factura ?? 0) - Number(detalle.total_iva ?? 0)))}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: 11.5 }}>IVA</span>
                    <strong>{pesos(detalle.total_iva ?? 0)}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: 11.5 }}>Total factura</span>
                    <strong style={{ fontSize: 15 }}>{pesos(detalle.total_factura ?? 0)}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: 11.5 }}>Firma digital</span>
                    <strong>{detalle.firmado ? "Firmada" : "Sin firmar"}</strong>
                  </div>
                </div>

                <div className="dt-formulario-seccion-titulo" style={{ margin: "16px 0 8px" }}>
                  <span>Productos</span>
                  <div>
                    <strong>Detalle de la factura</strong>
                    <p>
                      {cargandoDetalle
                        ? "Cargando líneas…"
                        : `${detalle.lineas?.length ?? 0} producto(s)`}
                    </p>
                  </div>
                </div>

                {cargandoDetalle ? (
                  <p style={{ color: "#64748b", fontSize: 13 }}>Consultando productos facturados…</p>
                ) : detalle.lineas && detalle.lineas.length > 0 ? (
                  <div className="dt-tabla-scroll">
                    <table className="dt-tabla">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Cant.</th>
                          <th>Precio unit.</th>
                          <th>Descuento</th>
                          <th>IVA</th>
                          <th>Total línea</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.lineas.map((linea) => (
                          <tr key={linea.id_detalle_factura}>
                            <td>
                              <strong>{linea.descripcion ?? `Producto ${linea.codigo_producto ?? ""}`}</strong>
                            </td>
                            <td>{Number(linea.cantidad ?? 0)}</td>
                            <td>{pesos(linea.precio_unitario ?? 0)}</td>
                            <td>{pesos(linea.descuento ?? 0)}</td>
                            <td>{pesos(linea.iva_valor ?? 0)}</td>
                            <td>
                              {pesos(Number(linea.total_linea ?? 0) + Number(linea.iva_valor ?? 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: "#64748b", fontSize: 13 }}>
                    Esta factura no tiene líneas de producto registradas.
                  </p>
                )}

                <div style={{ fontSize: 12, color: "#475569", borderTop: "1px solid #e2e8f0", paddingTop: 10, marginTop: 12 }}>
                  <div style={{ wordBreak: "break-all", marginBottom: 4 }}>
                    <strong>CUFE:</strong> {detalle.cufe ?? "Sin CUFE (falta firmar)"}
                  </div>
                  <div>
                    <strong>Respuesta DIAN:</strong> {detalle.mensaje_dian ?? "Sin respuesta todavía"}
                  </div>
                </div>
              </div>

              <div className="dt-formulario-seccion-titulo" style={{ marginTop: 18 }}>
                <span>XML</span>
                <div>
                  <strong>Documento técnico</strong>
                  <p>{xml ? `${xml.length} caracteres` : "No se pudo leer el XML"}</p>
                </div>
              </div>

              <pre
                style={{
                  maxHeight: 160,
                  overflow: "auto",
                  padding: 12,
                  borderRadius: 10,
                  background: "#f6f8fb",
                  border: "1px solid var(--dt-borde)",
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                {xml || "—"}
              </pre>
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
                className="dt-boton-secundario"
                onClick={descargarXml}
                disabled={!xml}
              >
                Descargar XML
              </button>

              <button
                type="button"
                className="dt-accion-principal"
                onClick={() => void descargarRepresentacionDian(detalle)}
              >
                <FileText size={15} />
                Imprimir / guardar PDF con formato de Ventas
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
