// src/pages/vendedor/panel-vendedor.tsx
//
// "Mi jornada": lo que el vendedor necesita ver al entrar — pedidos por
// despachar (con cambio de estado directo en la fila), ventas del día y
// devoluciones pendientes.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeftRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  PackageCheck,
  RefreshCw,
  Truck,
  X,
} from "../../components/iconos";

import {
  devoluciones,
  numero,
  pedidos,
  pesos,
  traerTodo,
  ventas,
} from "../../services/api";
import { useSesion } from "../../context/sesion-contexto";
import {
  Aviso,
  BarraListado,
  EncabezadoModulo,
  FilaIndicadores,
  Indicador,
  TablaCargando,
  TablaVacia,
  fecha,
} from "../../components/indicadores";
import type { Pedido } from "../../types";

const ESTADOS_GESTION = ["Pendiente", "Enviado", "Entregado"] as const;
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

export default function PanelVendedor() {
  const { usuario } = useSesion();

  const [pendientes, setPendientes] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [idActualizando, setIdActualizando] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [entregaPedido, setEntregaPedido] = useState<Pedido | null>(null);
  const [metodoPago, setMetodoPago] = useState(METODOS_PAGO[0]);
  const [resumen, setResumen] = useState({
    porDespachar: 0,
    ventasHoy: 0,
    ingresosHoy: 0,
    devolucionesPendientes: 0,
  });

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const [todosPedidos, todasVentas, todasDevoluciones] = await Promise.all([
        traerTodo((saltar, limite) => pedidos.listar({ saltar, limite })),
        traerTodo((saltar, limite) => ventas.listar({ saltar, limite })),
        traerTodo((saltar, limite) => devoluciones.listar({ saltar, limite })),
      ]);

      const abiertos = todosPedidos.items.filter(
        (pedido) => pedido.estado === "Pendiente" || pedido.estado === "Enviado"
      );

      const hoy = new Date().toDateString();
      const ventasDeHoy = todasVentas.items.filter(
        (venta) =>
          venta.estado === "Completada" &&
          venta.fecha_venta &&
          new Date(venta.fecha_venta).toDateString() === hoy
      );

      setPendientes(abiertos.slice(0, 6));
      setResumen({
        porDespachar: abiertos.length,
        ventasHoy: ventasDeHoy.length,
        ingresosHoy: ventasDeHoy.reduce(
          (suma, v) => suma + numero(v.total_pagado),
          0
        ),
        devolucionesPendientes: todasDevoluciones.items.filter(
          (d) => d.estado === "Pendiente"
        ).length,
      });
    } catch (fallo) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo cargar la jornada."
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const ingresos = useMemo(
    () => pesos(resumen.ingresosHoy),
    [resumen.ingresosHoy]
  );

  const seleccionarEstadoEnFila = async (
    pedido: Pedido,
    nuevoEstado: string
  ) => {
    const estadoActual = pedido.estado ?? "Pendiente";
    if (nuevoEstado === estadoActual) return;

    if (nuevoEstado === "Entregado") {
      setMetodoPago(METODOS_PAGO[0]);
      setEntregaPedido(pedido);
      return;
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
      setPendientes((actual) =>
        actual.map((item) =>
          item.id_pedido === actualizado.id_pedido ? actualizado : item
        )
      );
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
    if (!entregaPedido) return;

    const pedido = entregaPedido;
    setGuardando(true);
    setIdActualizando(pedido.id_pedido);
    setError("");
    setMensaje("");

    try {
      await pedidos.cambiarEstado(pedido.id_pedido, "Entregado", metodoPago);
      setEntregaPedido(null);
      setMensaje(
        `Pedido #${pedido.id_pedido} marcado como Entregado (${metodoPago}).`
      );
      await cargarDatos();
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

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Ventas"
        titulo="Mi jornada"
        descripcion="Pedidos por despachar, ventas del día y devoluciones en espera de revisión."
        rol={
          usuario ? { nombre: usuario.nombre_rol, clase: "vendedor" } : undefined
        }
        accion={
          <button
            type="button"
            className="dt-accion-principal"
            onClick={() => void cargarDatos()}
            disabled={cargando}
          >
            <RefreshCw size={15} className={cargando ? "dt-girando" : ""} />
            Actualizar
          </button>
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
          etiqueta="Por despachar"
          valor={resumen.porDespachar}
          descripcion="Pendientes y enviados"
          icono={Truck}
          tono="ambar"
          cargando={cargando}
        />
        <Indicador
          etiqueta="Ventas de hoy"
          valor={resumen.ventasHoy}
          descripcion="Completadas en el día"
          icono={CheckCircle2}
          tono="verde"
          cargando={cargando}
        />
        <Indicador
          etiqueta="Cobrado hoy"
          valor={ingresos}
          descripcion="Suma del día"
          icono={CreditCard}
          tono="azul"
          cargando={cargando}
        />
        <Indicador
          etiqueta="Devoluciones"
          valor={resumen.devolucionesPendientes}
          descripcion="Esperando revisión"
          icono={ArrowLeftRight}
          tono="rojo"
          cargando={cargando}
        />
      </FilaIndicadores>

      <section className="dt-listado">
        <BarraListado
          titulo="Pedidos por atender"
          descripcion="Cambia el estado directamente en la fila o abre el listado completo"
          Icono={ClipboardList}
        >
          <Link to="/vendedor/pedidos" className="dt-boton-secundario">
            Ver todos los pedidos
          </Link>
        </BarraListado>

        {cargando ? (
          <TablaCargando mensaje="Consultando los pedidos abiertos…" />
        ) : pendientes.length === 0 ? (
          <TablaVacia
            titulo="Todo al día"
            mensaje="No hay pedidos pendientes de despacho en este momento."
            Icono={CheckCircle2}
          />
        ) : (
          <div className="dt-tabla-scroll">
            <table className="dt-tabla">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Fecha</th>
                  <th>Unidades</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th className="dt-columna-acciones">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {pendientes.map((pedido) => {
                  const estadoActual = pedido.estado ?? "Pendiente";
                  const actualizandoFila = idActualizando === pedido.id_pedido;

                  return (
                    <tr key={pedido.id_pedido}>
                      <td>
                        <span className="dt-fila-principal">
                          Pedido #{pedido.id_pedido}
                        </span>
                        <span className="dt-fila-secundaria">
                          Cliente #{pedido.id_usuario_fk ?? "—"}
                        </span>
                      </td>

                      <td>{fecha(pedido.fecha_pedido)}</td>
                      <td>{pedido.total_unidades}</td>
                      <td>
                        <span className="dt-fila-principal">
                          {pesos(pedido.total)}
                        </span>
                      </td>

                      <td>
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
                      </td>

                      <td>
                        <div className="dt-acciones-fila">
                          <Link
                            to="/vendedor/pedidos"
                            className="dt-boton-secundario"
                          >
                            <Clock size={13} /> Detalle
                          </Link>
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

      {entregaPedido && (
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
