// src/pages/cliente/pedidos.tsx
//
// Historial de pedidos del cliente. Solo lectura: el cliente sigue el estado,
// quien lo mueve es el vendedor.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Eye, PackageCheck, RefreshCw, Store, Truck, X } from "../../components/iconos";

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

export default function MisPedidosVista() {
  const { usuario } = useSesion();

  const [lista, setLista] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [detalle, setDetalle] = useState<Pedido | null>(null);

  const cargarDatos = useCallback(async () => {
    if (!usuario) return;

    setCargando(true);
    setError("");

    try {
      const datos = await traerTodo((saltar, limite) =>
        pedidos.listar({ saltar, limite, id_usuario: usuario.id_usuario })
      );
      setLista(datos.items);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudieron cargar tus pedidos.");
    } finally {
      setCargando(false);
    }
  }, [usuario]);

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
      const coincideTexto = !texto || String(pedido.id_pedido).includes(texto);
      const coincideEstado = !filtroEstado || pedido.estado === filtroEstado;
      return coincideTexto && coincideEstado;
    });
  }, [lista, busqueda, filtroEstado]);

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Mi cuenta"
        titulo="Mis pedidos"
        descripcion="El recorrido de cada solicitud: pendiente, enviada y entregada."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "cliente" } : undefined}
        accion={
          <Link to="/cliente/productos" className="dt-accion-principal">
            <Store size={15} />
            Pedir de nuevo
          </Link>
        }
      />

      {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}

      <FilaIndicadores>
        <Indicador etiqueta="Pedidos" valor={resumen.total} descripcion="En tu historial" icono={ClipboardList} tono="azul" cargando={cargando} />
        <Indicador etiqueta="Pendientes" valor={resumen.pendientes} descripcion="Esperando despacho" icono={ClipboardList} tono="ambar" cargando={cargando} />
        <Indicador etiqueta="En camino" valor={resumen.enviados} descripcion="Ya salieron" icono={Truck} tono="morado" cargando={cargando} />
        <Indicador etiqueta="Entregados" valor={resumen.entregados} descripcion="Recibidos" icono={PackageCheck} tono="verde" cargando={cargando} />
      </FilaIndicadores>

      <section className="dt-listado">
        <BarraListado
          titulo="Historial"
          descripcion={`${filtrados.length} de ${lista.length} pedidos`}
          Icono={ClipboardList}
        >
          <CajaBusqueda valor={busqueda} onCambio={setBusqueda} marcador="N.º de pedido" />

          <FiltroEstado
            valor={filtroEstado}
            onCambio={setFiltroEstado}
            opciones={[
              { valor: "", texto: "Todos los estados" },
              { valor: "Pendiente", texto: "Pendientes" },
              { valor: "Enviado", texto: "Enviados" },
              { valor: "Entregado", texto: "Entregados" },
              { valor: "Cancelado", texto: "Cancelados" },
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
          <TablaCargando mensaje="Consultando tus pedidos…" />
        ) : filtrados.length === 0 ? (
          <TablaVacia
            titulo="Sin pedidos"
            mensaje="Todavía no tienes pedidos con ese criterio."
            Icono={ClipboardList}
            accion={
              <Link to="/cliente/productos" className="dt-accion-principal">
                <Store size={15} /> Ver catálogo
              </Link>
            }
          />
        ) : (
          <div className="dt-tabla-scroll">
            <table className="dt-tabla">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Fecha</th>
                  <th>Productos</th>
                  <th>Unidades</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th className="dt-columna-acciones">Detalle</th>
                </tr>
              </thead>

              <tbody>
                {filtrados.map((pedido) => (
                  <tr key={pedido.id_pedido}>
                    <td>
                      <span className="dt-fila-principal">#{pedido.id_pedido}</span>
                    </td>
                    <td>{fecha(pedido.fecha_pedido)}</td>
                    <td>{pedido.items.length}</td>
                    <td>{pedido.total_unidades}</td>
                    <td>
                      <span className="dt-fila-principal">{pesos(pedido.total)}</span>
                      {Number(pedido.descuento_total) > 0 && (
                        <span className="dt-fila-secundaria">
                          Ahorraste {pesos(pedido.descuento_total)}
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
                          onClick={() => setDetalle(pedido)}
                          title="Ver detalle"
                        >
                          <Eye size={14} />
                        </button>
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
                  {fecha(detalle.fecha_pedido)} · {detalle.estado}
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
