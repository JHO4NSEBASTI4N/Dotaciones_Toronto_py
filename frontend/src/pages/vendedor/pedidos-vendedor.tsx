// src/pages/vendedor/pedidos-vendedor.tsx
//
// Pedidos del vendedor: permite cambiar el estado directamente en la misma fila
// del pedido (Pendiente, Enviado, Entregado) o cancelarlo.
// Al pasar a "Entregado" el backend genera la venta y descuenta inventario;
// si se revierte desde "Entregado", repone inventario y anula la venta.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  ClipboardList,
  CreditCard,
  Eye,
  PackageCheck,
  RefreshCw,
  Truck,
  X,
} from "../../components/iconos";

import { pedidos, pesos, traerTodo } from "../../services/api";
import { BotonesReportesAdmin } from "../../components/botones-reportes-admin";
import { contarPorCategoria } from "../../services/analitica-reportes";
import type { ReporteAdmin } from "../../services/reportes";
import { ROL_VENDEDOR, useSesion } from "../../context/sesion-contexto";
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
import type { Pedido } from "../../types";

const ESTADOS_GESTION = ["Pendiente", "Enviado", "Entregado"] as const;
const ESTADOS_FILTRO = ["Pendiente", "Enviado", "Entregado", "Cancelado"];

// Métodos de pago que puede registrar el vendedor al entregar un pedido
// (se guarda en la venta y sale en el reporte).
const METODOS_PAGO = [
  "Efectivo",
  "Tarjeta",
  "Transferencia",
  "Nequi",
  "DaviPlata",
  "Otro",
];

function claseSelectEstado(estado: string | null | undefined): string {
  switch ((estado ?? "").toLowerCase()) {
    case "entregado":
      return "es-entregado";
    case "enviado":
      return "es-enviado";
    default:
      return "es-pendiente";
  }
}

export default function PedidosVendedor() {
  const { usuario, esAdministrador } = useSesion();
  // Solo el vendedor puede cambiar el estado de un pedido; el administrador
  // únicamente consulta, revisa detalles y descarga reportes.
  const puedeCambiarEstado = usuario?.id_rol === ROL_VENDEDOR;

  const [lista, setLista] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [idActualizando, setIdActualizando] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [detalle, setDetalle] = useState<Pedido | null>(null);

  // Modal de entrega: se elige el método de pago al generar la venta.
  const [entregaPedido, setEntregaPedido] = useState<Pedido | null>(null);
  const [metodoPago, setMetodoPago] = useState(METODOS_PAGO[0]);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const datos = await traerTodo((saltar, limite) =>
        pedidos.listar({ saltar, limite })
      );
      // Defensa adicional en la interfaz: ocultamos por estado, no por el bit
      // legacy `oculto`, para conservar pendientes/enviados aunque ese bit esté mal.
      setLista(datos.items.filter((pedido) => pedido.estado !== "Entregado"));
    } catch (fallo) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudieron cargar los pedidos."
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
      pendientes: lista.filter((p) => p.estado === "Pendiente").length,
      enviados: lista.filter((p) => p.estado === "Enviado").length,
      entregados: lista.filter((p) => p.estado === "Entregado").length,
    }),
    [lista]
  );

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return lista.filter((pedido) => {
      const coincideTexto =
        !texto ||
        String(pedido.id_pedido).includes(texto) ||
        String(pedido.id_usuario_fk ?? "").includes(texto);

      const coincideEstado = !filtroEstado || pedido.estado === filtroEstado;

      return coincideTexto && coincideEstado;
    });
  }, [lista, busqueda, filtroEstado]);

  const crearReporte = (): ReporteAdmin => ({
    modulo: "pedidos",
    titulo: "Reporte de pedidos",
    generado_por: usuario?.nombre ?? "Administrador",
    indicadores: [
      { etiqueta: "Pedidos filtrados", valor: String(filtrados.length) },
      {
        etiqueta: "Pendientes",
        valor: String(
          filtrados.filter((pedido) => pedido.estado === "Pendiente").length
        ),
      },
      {
        etiqueta: "Enviados",
        valor: String(
          filtrados.filter((pedido) => pedido.estado === "Enviado").length
        ),
      },
      {
        etiqueta: "Entregados",
        valor: String(
          filtrados.filter((pedido) => pedido.estado === "Entregado").length
        ),
      },
    ],
    columnas: [
      { clave: "id", titulo: "Pedido" },
      { clave: "cliente", titulo: "ID cliente" },
      { clave: "fecha", titulo: "Fecha" },
      { clave: "items", titulo: "Ítems" },
      { clave: "unidades", titulo: "Unidades" },
      { clave: "total_cop", titulo: "Total COP" },
      { clave: "descuento_cop", titulo: "Descuento COP" },
      { clave: "estado", titulo: "Estado" },
    ],
    filas: filtrados.map((pedido) => ({
      id: pedido.id_pedido,
      cliente: pedido.id_usuario_fk,
      fecha: pedido.fecha_pedido,
      items: pedido.items.length,
      unidades: pedido.total_unidades,
      total_cop: Number(pedido.total),
      descuento_cop: Number(pedido.descuento_total),
      estado: pedido.estado,
    })),
    grafica: contarPorCategoria(
      filtrados.map((pedido) => pedido.estado ?? "Sin estado"),
      "Pedidos por estado"
    ),
  });

  /**
   * Sincroniza el pedido actualizado en memoria. Si quedó oculto (como al
   * entregarlo), lo quitamos de inmediato del listado sin esperar a recargar.
   */
  const reemplazarPedido = (actualizado: Pedido) => {
    if (actualizado.estado === "Entregado") {
      setLista((actual) =>
        actual.filter((item) => item.id_pedido !== actualizado.id_pedido)
      );
      setDetalle((actual) =>
        actual?.id_pedido === actualizado.id_pedido ? null : actual
      );
      return;
    }

    setLista((actual) =>
      actual.map((item) =>
        item.id_pedido === actualizado.id_pedido ? actualizado : item
      )
    );
    setDetalle((actual) =>
      actual?.id_pedido === actualizado.id_pedido ? actualizado : actual
    );
  };

  /** Maneja el cambio de estado directamente desde el selector de la fila. */
  const seleccionarEstadoEnFila = async (
    pedido: Pedido,
    nuevoEstado: string
  ) => {
    if (!puedeCambiarEstado) return;
    const estadoActual = pedido.estado ?? "Pendiente";
    if (nuevoEstado === estadoActual) return;

    // Si pasa a Entregado, pedimos el método de pago para registrar la venta.
    if (nuevoEstado === "Entregado") {
      setMetodoPago(METODOS_PAGO[0]);
      setEntregaPedido(pedido);
      return;
    }

    // Si estaba Entregado y vuelve a Pendiente o Enviado, pedimos confirmación.
    if (estadoActual === "Entregado") {
      const confirmado = window.confirm(
        `¿Cambiar el pedido #${pedido.id_pedido} de Entregado a ${nuevoEstado}? Se repondrá el inventario y se anulará la venta asociada.`
      );
      if (!confirmado) return;
    }

    setGuardando(true);
    setIdActualizando(pedido.id_pedido);
    setError("");
    setMensaje("");

    try {
      const actualizado = await pedidos.cambiarEstado(
        pedido.id_pedido,
        nuevoEstado
      );
      reemplazarPedido(actualizado);
      setMensaje(`Pedido #${pedido.id_pedido} actualizado a ${nuevoEstado}.`);
    } catch (fallo) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo cambiar el estado del pedido."
      );
    } finally {
      setGuardando(false);
      setIdActualizando(null);
    }
  };

  const confirmarEntrega = async () => {
    if (!puedeCambiarEstado || !entregaPedido) return;

    const pedido = entregaPedido;
    setGuardando(true);
    setIdActualizando(pedido.id_pedido);
    setError("");
    setMensaje("");

    try {
      const actualizado = await pedidos.cambiarEstado(
        pedido.id_pedido,
        "Entregado",
        metodoPago
      );
      reemplazarPedido(actualizado);
      setMensaje(
        `Pedido #${pedido.id_pedido} marcado como Entregado (${metodoPago}).`
      );
      setEntregaPedido(null);
    } catch (fallo) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo entregar el pedido."
      );
    } finally {
      setGuardando(false);
      setIdActualizando(null);
    }
  };

  const cancelar = async (pedido: Pedido) => {
    if (!puedeCambiarEstado) return;
    const confirmado = window.confirm(
      `¿Cancelar el pedido #${pedido.id_pedido}? No se borra: queda marcado como Cancelado.`
    );
    if (!confirmado) return;

    setGuardando(true);
    setIdActualizando(pedido.id_pedido);
    setError("");
    setMensaje("");

    try {
      const actualizado = await pedidos.cancelar(pedido.id_pedido);
      reemplazarPedido(actualizado);
      setMensaje(`Pedido #${pedido.id_pedido} cancelado.`);
    } catch (fallo) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo cancelar el pedido."
      );
    } finally {
      setGuardando(false);
      setIdActualizando(null);
    }
  };

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion={esAdministrador ? "Administración" : "Ventas"}
        titulo="Pedidos"
        descripcion={
          esAdministrador
            ? "Consulta el listado de pedidos, revisa su detalle y exporta reportes."
            : "Cambia el estado de cada pedido (Pendiente, Enviado o Entregado) directamente desde su fila."
        }
        rol={
          usuario
            ? {
                nombre: usuario.nombre_rol,
                clase: esAdministrador ? "admin" : "vendedor",
              }
            : undefined
        }
        accion={
          <div className="dt-acciones-admin-encabezado">
            {esAdministrador && (
              <BotonesReportesAdmin
                crearReporte={crearReporte}
                alError={setError}
                deshabilitado={cargando}
              />
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

      {error && (
        <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />
      )}
      {mensaje && (
        <Aviso tipo="exito" mensaje={mensaje} onCerrar={() => setMensaje("")} />
      )}

      <FilaIndicadores>
        <Indicador
          etiqueta="Pedidos"
          valor={resumen.total}
          descripcion="Registrados"
          icono={ClipboardList}
          tono="azul"
          cargando={cargando}
        />
        <Indicador
          etiqueta="Pendientes"
          valor={resumen.pendientes}
          descripcion="Sin despachar"
          icono={ClipboardList}
          tono="ambar"
          cargando={cargando}
        />
        <Indicador
          etiqueta="Enviados"
          valor={resumen.enviados}
          descripcion="En camino al cliente"
          icono={Truck}
          tono="morado"
          cargando={cargando}
        />
        <Indicador
          etiqueta="Entregados"
          valor={resumen.entregados}
          descripcion="Ya son venta"
          icono={PackageCheck}
          tono="verde"
          cargando={cargando}
        />
      </FilaIndicadores>

      <section className="dt-listado">
        <BarraListado
          titulo="Listado de pedidos"
          descripcion={`${filtrados.length} de ${lista.length} pedidos`}
          Icono={ClipboardList}
        >
          <CajaBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            marcador="N.º de pedido o cliente"
          />

          <FiltroEstado
            valor={filtroEstado}
            onCambio={setFiltroEstado}
            opciones={[
              { valor: "", texto: "Todos los estados" },
              ...ESTADOS_FILTRO.map((estado) => ({
                valor: estado,
                texto: estado,
              })),
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
          <TablaCargando mensaje="Consultando los pedidos…" />
        ) : filtrados.length === 0 ? (
          <TablaVacia
            titulo="No hay pedidos"
            mensaje="Ajusta los filtros: todavía no hay pedidos con ese criterio."
            Icono={ClipboardList}
          />
        ) : (
          <div className="dt-tabla-scroll">
            <table className="dt-tabla">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Fecha</th>
                  <th>Ítems</th>
                  <th>Unidades</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th className="dt-columna-acciones">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filtrados.map((pedido) => {
                  const estadoActual = pedido.estado ?? "Pendiente";
                  const actualizandoFila = idActualizando === pedido.id_pedido;

                  return (
                    <tr key={pedido.id_pedido}>
                      <td>
                        <span className="dt-fila-principal">
                          #{pedido.id_pedido}
                        </span>
                        <span className="dt-fila-secundaria">
                          Cliente {pedido.id_usuario_fk ?? "—"}
                        </span>
                      </td>

                      <td>{fecha(pedido.fecha_pedido)}</td>
                      <td>{pedido.items.length}</td>
                      <td>{pedido.total_unidades}</td>

                      <td>
                        <span className="dt-fila-principal">
                          {pesos(pedido.total)}
                        </span>
                        {Number(pedido.descuento_total) > 0 && (
                          <span className="dt-fila-secundaria">
                            Descuento {pesos(pedido.descuento_total)}
                          </span>
                        )}
                      </td>

                      <td>
                        {!puedeCambiarEstado || estadoActual === "Cancelado" ? (
                          <EtiquetaEstado
                            tipo={tonoDeEstado(estadoActual)}
                            texto={estadoActual}
                          />
                        ) : (
                          <div className="dt-estado-fila">
                            <label
                              className={`dt-estado-select-caja ${claseSelectEstado(estadoActual)}`}
                            >
                              <span
                                className="dt-estado-select-punto"
                                aria-hidden="true"
                              />
                              <select
                                className="dt-estado-select"
                                value={estadoActual}
                                disabled={guardando}
                                aria-label={`Cambiar estado del pedido #${pedido.id_pedido}`}
                                onChange={(evento) =>
                                  void seleccionarEstadoEnFila(
                                    pedido,
                                    evento.target.value
                                  )
                                }
                              >
                                {ESTADOS_GESTION.map((opcion) => (
                                  <option key={opcion} value={opcion}>
                                    {opcion}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {actualizandoFila && (
                              <span
                                className="dt-spinner"
                                aria-label="Guardando estado"
                              />
                            )}
                          </div>
                        )}
                      </td>

                      <td>
                        <div className="dt-acciones-fila">
                          <button
                            type="button"
                            className="dt-boton-icono"
                            title="Ver detalle"
                            onClick={() => setDetalle(pedido)}
                          >
                            <Eye size={14} />
                          </button>

                          {puedeCambiarEstado &&
                            estadoActual !== "Cancelado" &&
                            estadoActual !== "Entregado" && (
                              <button
                                type="button"
                                className="dt-boton-icono dt-boton-peligro"
                                title="Cancelar pedido"
                                disabled={guardando}
                                onClick={() => void cancelar(pedido)}
                              >
                                <Ban size={14} />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
                <ClipboardList size={21} />
              </span>

              <div className="dt-modal-titulo-grupo">
                <span className="dt-migas">Pedido</span>
                <h2>Pedido #{detalle.id_pedido}</h2>
                <p>
                  {fecha(detalle.fecha_pedido)} · {detalle.estado} ·{" "}
                  {detalle.total_unidades} unidades
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
              <section style={{
                marginBottom: 18,
                padding: "16px 18px",
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                background: "linear-gradient(135deg, #f8fafc, #ffffff)",
              }}>
                <div style={{ marginBottom: 12 }}>
                  <span style={{ display: "block", color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                    Información del cliente
                  </span>
                  <strong style={{ display: "block", marginTop: 4, color: "#0f172a", fontSize: 16 }}>
                    {detalle.cliente?.nombre ?? "Cliente sin información"}
                  </strong>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "12px 18px" }}>
                  <div>
                    <span style={{ display: "block", color: "#64748b", fontSize: 12 }}>Documento</span>
                    <strong style={{ color: "#1e293b", fontSize: 13 }}>{detalle.cliente?.documento || "No registrado"}</strong>
                  </div>
                  <div>
                    <span style={{ display: "block", color: "#64748b", fontSize: 12 }}>Teléfono</span>
                    <strong style={{ color: "#1e293b", fontSize: 13 }}>{detalle.cliente?.telefono || "No registrado"}</strong>
                  </div>
                  <div>
                    <span style={{ display: "block", color: "#64748b", fontSize: 12 }}>Correo</span>
                    <strong style={{ color: "#1e293b", fontSize: 13, overflowWrap: "anywhere" }}>{detalle.cliente?.correo || "No registrado"}</strong>
                  </div>
                  <div>
                    <span style={{ display: "block", color: "#64748b", fontSize: 12 }}>Dirección de entrega</span>
                    <strong style={{ color: "#1e293b", fontSize: 13 }}>{detalle.cliente?.direccion || "No registrada"}</strong>
                  </div>
                  <div>
                    <span style={{ display: "block", color: "#64748b", fontSize: 12 }}>ID de cliente</span>
                    <strong style={{ color: "#1e293b", fontSize: 13 }}>{detalle.cliente?.id_usuario ?? detalle.id_usuario_fk ?? "—"}</strong>
                  </div>
                </div>
              </section>

              <div className="dt-tabla-scroll">
                <table className="dt-tabla">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cant.</th>
                      <th>Precio</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>

                  <tbody>
                    {detalle.items.map((item) => (
                      <tr key={item.id_detalle_pedido}>
                        <td>
                          {item.nombre_producto ??
                            `Producto ${item.id_producto}`}
                        </td>
                        <td>{item.cantidad}</td>
                        <td>{pesos(item.precio_unitario)}</td>
                        <td>{pesos(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                className="dt-listado-contexto"
                style={{ marginTop: 12, borderRadius: 10 }}
              >
                <span>
                  <span className="dt-punto-contexto" />
                  Total del pedido
                </span>
                <strong>{pesos(detalle.total)}</strong>
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
            </footer>
          </section>
        </div>
      )}

      {puedeCambiarEstado && entregaPedido && (
        <div
          className="dt-modal-fondo"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget && !guardando) {
              setEntregaPedido(null);
            }
          }}
        >
          <section className="dt-modal" role="dialog" aria-modal="true">
            <header className="dt-modal-encabezado">
              <span className="dt-modal-icono">
                <CreditCard size={21} />
              </span>

              <div className="dt-modal-titulo-grupo">
                <span className="dt-migas">Entrega</span>
                <h2>Entregar pedido #{entregaPedido.id_pedido}</h2>
                <p>
                  Se genera la venta y se descuenta el inventario registrando el
                  método de pago elegido.
                </p>
              </div>

              <button
                type="button"
                className="dt-boton-cerrar-modal"
                onClick={() => setEntregaPedido(null)}
                disabled={guardando}
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </header>

            <div className="dt-formulario-contenido">
              <label className="dt-campo-ancho">
                Método de pago
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  disabled={guardando}
                >
                  {METODOS_PAGO.map((metodo) => (
                    <option key={metodo} value={metodo}>
                      {metodo}
                    </option>
                  ))}
                </select>
              </label>

              <p
                style={{
                  color: "#64748b",
                  fontSize: "0.85rem",
                  marginTop: 12,
                }}
              >
                Total del pedido:{" "}
                <strong style={{ color: "#0f172a" }}>
                  {pesos(entregaPedido.total)}
                </strong>{" "}
                · {entregaPedido.total_unidades} unidades
              </p>
            </div>

            <footer className="dt-modal-acciones">
              <button
                type="button"
                className="dt-boton-secundario"
                onClick={() => setEntregaPedido(null)}
                disabled={guardando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="dt-accion-principal"
                onClick={() => void confirmarEntrega()}
                disabled={guardando}
              >
                <PackageCheck size={15} />
                {guardando ? "Guardando…" : "Confirmar entrega"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
