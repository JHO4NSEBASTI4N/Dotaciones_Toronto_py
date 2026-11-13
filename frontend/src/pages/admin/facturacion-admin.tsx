// src/pages/admin/facturacion-admin.tsx
//
// facturacion_admin.html del proyecto Java.
// Facturas electrónicas (DIAN): listar, firmar, enviar, consultar estado,
// anular y bajar el XML. La emisión es simulada, pero el flujo es el real.

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
import { facturas, pesos, traerTodo } from "../../services/api";
import { useSesion } from "../../context/sesion-contexto";
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

    try {
      const respuesta = await facturas.xml(factura.id_factura);
      setXml(respuesta.xml);
    } catch {
      setXml("");
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

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Administración"
        titulo="Facturación electrónica"
        descripcion="Facturas generadas desde las ventas: firma, envío a la DIAN y anulación. Emisión simulada, flujo real."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "admin" } : undefined}
        accion={
          <div style={{ display: "flex", gap: 8 }}>
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
            mensaje="Las facturas aparecen cuando se entrega un pedido y se genera la venta."
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
                          title="Ver detalle y XML"
                          onClick={() => void abrirDetalle(factura)}
                        >
                          <Eye size={14} />
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
              <div className="dt-formulario-grid">
                <label>
                  Emisor
                  <input value={detalle.razon_social_emisor ?? "—"} disabled />
                </label>
                <label>
                  NIT emisor
                  <input value={detalle.nit_emisor ?? "—"} disabled />
                </label>
                <label>
                  Adquirente
                  <input value={detalle.razon_social_adquirente ?? "—"} disabled />
                </label>
                <label>
                  Total factura
                  <input value={pesos(detalle.total_factura ?? 0)} disabled />
                </label>

                <label className="dt-campo-ancho">
                  CUFE
                  <input value={detalle.cufe ?? "Sin CUFE (falta firmar)"} disabled />
                </label>

                <label className="dt-campo-ancho">
                  Mensaje DIAN
                  <input value={detalle.mensaje_dian ?? "Sin respuesta todavía"} disabled />
                </label>
              </div>

              <div className="dt-formulario-seccion-titulo" style={{ marginTop: 18 }}>
                <span>XML</span>
                <div>
                  <strong>Documento generado</strong>
                  <p>{xml ? `${xml.length} caracteres` : "No se pudo leer el XML"}</p>
                </div>
              </div>

              <pre
                style={{
                  maxHeight: 220,
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
                className="dt-accion-principal"
                onClick={descargarXml}
                disabled={!xml}
              >
                Descargar XML
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
