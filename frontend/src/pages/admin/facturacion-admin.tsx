// src/pages/admin/facturacion-admin.tsx
//
// facturacion_admin.html del proyecto Java.
// Facturas electrónicas (DIAN): listar, firmar, enviar, consultar estado,
// anular y descargar el XML y la representación gráfica PDF del mismo documento.
// La emisión actual es simulada, aunque conserva el flujo y los artefactos.

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Eye,
  FileText,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  TriangleAlert,
  X,
} from "../../components/iconos";
import { BASE_URL, facturas, pesos, traerTodo, ventas } from "../../services/api";
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
import type { Venta } from "../../entity/Venta";

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
  const [modalGenerar, setModalGenerar] = useState(false);
  const [ventasDisponibles, setVentasDisponibles] = useState<Venta[]>([]);
  const [ventaSeleccionada, setVentaSeleccionada] = useState("");
  const [cargandoVentas, setCargandoVentas] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [errorGenerar, setErrorGenerar] = useState("");

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

  const abrirGeneracion = async () => {
    setModalGenerar(true);
    setVentaSeleccionada("");
    setVentasDisponibles([]);
    setErrorGenerar("");
    setCargandoVentas(true);
    try {
      const datos = await traerTodo((saltar, limite) =>
        ventas.listar({ saltar, limite, estado: "Completada" })
      );
      const ventasConFactura = new Set(
        lista.map((factura) => factura.id_venta_fk).filter((id): id is number => id !== null)
      );
      setVentasDisponibles(
        datos.items.filter(
          (venta) => venta.estado === "Completada" && !ventasConFactura.has(venta.id_venta)
        )
      );
    } catch (fallo) {
      setErrorGenerar(
        fallo instanceof Error ? fallo.message : "No se pudieron consultar las ventas completadas."
      );
    } finally {
      setCargandoVentas(false);
    }
  };

  const generarFactura = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const idVenta = Number(ventaSeleccionada);
    if (!Number.isInteger(idVenta) || idVenta <= 0) {
      setErrorGenerar("Selecciona una venta completada.");
      return;
    }

    setGenerando(true);
    setErrorGenerar("");
    try {
      const factura = await facturas.crear({ id_venta: idVenta });
      setModalGenerar(false);
      setMensaje(`Factura DIAN ${factura.numero_factura} generada en estado borrador.`);
      await cargarDatos();
    } catch (fallo) {
      setErrorGenerar(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo generar la factura. Verifica que exista una resolución DIAN vigente."
      );
    } finally {
      setGenerando(false);
    }
  };

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

  const descargarRepresentacionDian = async (factura: FacturaElectronica) => {
    try {
      const token = localStorage.getItem("token");
      const respuesta = await fetch(
        `${BASE_URL}/facturas-electronicas/${factura.id_factura}/pdf`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!respuesta.ok) {
        let mensaje = `No se pudo descargar el PDF DIAN (${respuesta.status}).`;
        try {
          const datos = await respuesta.json();
          mensaje = datos?.detail ?? datos?.detalle ?? mensaje;
        } catch { /* la respuesta puede no ser JSON */ }
        throw new Error(mensaje);
      }
      const archivo = await respuesta.blob();
      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `${factura.numero_factura}-DIAN.pdf`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch (fallo) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo descargar la representación gráfica DIAN."
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
            <button type="button" className="dt-accion-principal" onClick={() => void abrirGeneracion()}>
              <Plus size={15} /> Generar factura DIAN
            </button>
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
            mensaje="El PDF y el XML se descargan del mismo registro de factura electrónica DIAN. La factura convencional de Ventas es un comprobante distinto. Las nuevas entregas generan un borrador automáticamente cuando hay resolución vigente; usa «Generar factura DIAN» para recuperar ventas anteriores o pendientes."
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
                          title="Descargar representación gráfica DIAN (PDF)"
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

      {modalGenerar && (
        <div
          className="dt-modal-fondo"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget && !generando) setModalGenerar(false);
          }}
        >
          <section className="dt-modal" role="dialog" aria-modal="true" aria-labelledby="generar-factura-titulo">
            <header className="dt-modal-encabezado">
              <span className="dt-modal-icono"><FileText size={21} /></span>
              <div className="dt-modal-titulo-grupo">
                <span className="dt-migas">Facturación electrónica</span>
                <h2 id="generar-factura-titulo">Generar factura DIAN</h2>
                <p>Selecciona una venta completada que todavía no tenga documento electrónico.</p>
              </div>
              <button
                type="button"
                className="dt-boton-cerrar-modal"
                onClick={() => setModalGenerar(false)}
                disabled={generando}
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </header>

            <form onSubmit={(evento) => void generarFactura(evento)} noValidate>
              <div className="dt-formulario-contenido">
                <p style={{ marginTop: 0, fontSize: 13, color: "#475569" }}>
                  Al entregar el pedido se crea este borrador automáticamente. En modo simulado se usa numeración SIM si falta resolución; no tiene validez fiscal ni se transmite. Para emisión DIAN real sí debes registrar una resolución oficial vigente.
                  {" "}<Link to="/admin/facturacion/config">Consultar resoluciones</Link>
                </p>

                {errorGenerar && <Aviso tipo="error" mensaje={errorGenerar} />}

                <label className="dt-campo-ancho">
                  Venta completada <span>*</span>
                  <select
                    value={ventaSeleccionada}
                    onChange={(evento) => setVentaSeleccionada(evento.target.value)}
                    disabled={cargandoVentas || generando || ventasDisponibles.length === 0}
                    required
                  >
                    <option value="">
                      {cargandoVentas
                        ? "Cargando ventas…"
                        : ventasDisponibles.length
                          ? "Selecciona una venta"
                          : "No hay ventas pendientes de facturar"}
                    </option>
                    {ventasDisponibles.map((venta) => (
                      <option key={venta.id_venta} value={venta.id_venta}>
                        Venta #{venta.id_venta} · Pedido #{venta.id_pedido_fk ?? "—"} · {fecha(venta.fecha_venta)} · {pesos(venta.total_pagado)}
                      </option>
                    ))}
                  </select>
                </label>

                {!cargandoVentas && ventasDisponibles.length === 0 && !errorGenerar && (
                  <p role="status" style={{ fontSize: 13, color: "#64748b" }}>
                    La venta y el pedido se conservan aunque falle la emisión DIAN; las ventas completadas sin documento quedan disponibles aquí para reintentar la generación.
                  </p>
                )}
              </div>

              <footer className="dt-modal-acciones">
                <button
                  type="button"
                  className="dt-boton-secundario"
                  onClick={() => setModalGenerar(false)}
                  disabled={generando}
                >Cancelar</button>
                <button
                  type="submit"
                  className="dt-accion-principal"
                  disabled={generando || cargandoVentas || !ventaSeleccionada}
                >
                  {generando ? <span className="dt-spinner" /> : <Plus size={15} />}
                  {generando ? "Generando…" : "Crear borrador DIAN"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

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
                Descargar representación gráfica DIAN (PDF)
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
