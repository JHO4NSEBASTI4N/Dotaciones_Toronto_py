// src/pages/vendedor/pedidos.tsx
//
// Pedidos: se cambia el estado (Pendiente → Enviado → Entregado) o se cancelan.
// Al pasar a "Entregado" el backend genera la venta y descuenta inventario.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, ClipboardList, Eye, PackageCheck, RefreshCw, Truck, X } from "../../components/iconos";

import { pedidos, pesos, traerTodo } from "../../services/api";
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
import type { Pedido } from "../../types";

const ESTADOS = ["Pendiente", "Enviado", "Entregado", "Cancelado"];

export default function PedidosVendedor() {
  const { usuario } = useSesion();

  const [lista, setLista] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [detalle, setDetalle] = useState<Pedido | null>(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const datos = await traerTodo((saltar, limite) => pedidos.listar({ saltar, limite }));
      setLista(datos.items);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudieron cargar los pedidos.");
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

  const cambiarEstado = async (pedido: Pedido, nuevoEstado: string) => {
    const confirmado = window.confirm(
      nuevoEstado === "Entregado"
        ? `¿Marcar el pedido #${pedido.id_pedido} como Entregado? Se genera la venta y se descuenta el inventario.`
        : `¿Pasar el pedido #${pedido.id_pedido} a ${nuevoEstado}?`
    );
    if (!confirmado) return;

    setGuardando(true);
    setError("");

    try {
      await pedidos.cambiarEstado(pedido.id_pedido, nuevoEstado);
      setMensaje(`Pedido #${pedido.id_pedido} quedó en ${nuevoEstado}.`);
      await cargarDatos();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo cambiar el estado.");
    } finally {
      setGuardando(false);
    }
  };

  const cancelar = async (pedido: Pedido) => {
    const confirmado = window.confirm(
      `¿Cancelar el pedido #${pedido.id_pedido}? No se borra: queda marcado como Cancelado.`
    );
    if (!confirmado) return;

    setGuardando(true);
    setError("");

    try {
      await pedidos.cancelar(pedido.id_pedido);
      setMensaje(`Pedido #${pedido.id_pedido} cancelado.`);
      await cargarDatos();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo cancelar el pedido.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Ventas"
        titulo="Pedidos"
        descripcion="Cada pedido avanza Pendiente → Enviado → Entregado. Al entregarlo se crea la venta."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "vendedor" } : undefined}
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

      {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}
      {mensaje && <Aviso tipo="exito" mensaje={mensaje} onCerrar={() => setMensaje("")} />}

      <FilaIndicadores>
        <Indicador etiqueta="Pedidos" valor={resumen.total} descripcion="Registrados" icono={ClipboardList} tono="azul" cargando={cargando} />
        <Indicador etiqueta="Pendientes" valor={resumen.pendientes} descripcion="Sin despachar" icono={ClipboardList} tono="ambar" cargando={cargando} />
        <Indicador etiqueta="Enviados" valor={resumen.enviados} descripcion="En camino al cliente" icono={Truck} tono="morado" cargando={cargando} />
        <Indicador etiqueta="Entregados" valor={resumen.entregados} descripcion="Ya son venta" icono={PackageCheck} tono="verde" cargando={cargando} />
      </FilaIndicadores>

      <section className="dt-listado">
        <BarraListado
          titulo="Listado de pedidos"
          descripcion={`${filtrados.length} de ${lista.length} pedidos`}
          Icono={ClipboardList}
        >
          <CajaBusqueda valor={busqueda} onCambio={setBusqueda} marcador="N.º de pedido o cliente" />

          <FiltroEstado
            valor={filtroEstado}
            onCambio={setFiltroEstado}
            opciones={[
              { valor: "", texto: "Todos los estados" },
              ...ESTADOS.map((estado) => ({ valor: estado, texto: estado })),
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
                {filtrados.map((pedido) => (
                  <tr key={pedido.id_pedido}>
                    <td>
                      <span className="dt-fila-principal">#{pedido.id_pedido}</span>
                      <span className="dt-fila-secundaria">
                        Cliente {pedido.id_usuario_fk ?? "—"}
                      </span>
                    </td>

                    <td>{fecha(pedido.fecha_pedido)}</td>
                    <td>{pedido.items.length}</td>
                    <td>{pedido.total_unidades}</td>

                    <td>
                      <span className="dt-fila-principal">{pesos(pedido.total)}</span>
                      {Number(pedido.descuento_total) > 0 && (
                        <span className="dt-fila-secundaria">
                          Descuento {pesos(pedido.descuento_total)}
                        </span>
                      )}
                    </td>

                    <td>
                      <EtiquetaEstado
                        tipo={tonoDeEstado(pedido.estado ?? "")}
                        texto={pedido.estado ?? "—"}
                      />
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

                        {pedido.estado === "Pendiente" && (
                          <button
                            type="button"
                            className="dt-boton-icono"
                            title="Marcar como Enviado"
                            disabled={guardando}
                            onClick={() => void cambiarEstado(pedido, "Enviado")}
                          >
                            <Truck size={14} />
                          </button>
                        )}

                        {pedido.estado === "Enviado" && (
                          <button
                            type="button"
                            className="dt-boton-icono"
                            title="Marcar como Entregado"
                            disabled={guardando}
                            onClick={() => void cambiarEstado(pedido, "Entregado")}
                          >
                            <PackageCheck size={14} />
                          </button>
                        )}

                        {pedido.estado !== "Cancelado" && pedido.estado !== "Entregado" && (
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
                        <td>{item.nombre_producto ?? `Producto ${item.id_producto}`}</td>
                        <td>{item.cantidad}</td>
                        <td>{pesos(item.precio_unitario)}</td>
                        <td>{pesos(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="dt-listado-contexto" style={{ marginTop: 12, borderRadius: 10 }}>
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
    </section>
  );
}
