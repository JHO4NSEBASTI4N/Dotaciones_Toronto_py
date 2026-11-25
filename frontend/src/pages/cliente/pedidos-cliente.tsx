// src/pages/cliente/pedidos.tsx
//
// Historial de pedidos del cliente. Solo lectura: el cliente sigue el estado,
// quien lo mueve es el vendedor.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Eye, FileText, PackageCheck, RefreshCw, Store, Truck, X } from "../../components/iconos";
import logoNegro from "../../assets/images/logo negro.png";

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

  const descargarFacturaPedido = (pedido: Pedido) => {
    const total = Number(pedido.total ?? 0);
    const subtotalLista = Number(pedido.subtotal_lista ?? total);
    const descuento = Number(pedido.descuento_total ?? 0);
    const itemsPedido = pedido.items ?? [];
    const filas = itemsPedido.length
      ? itemsPedido
          .map(
            (item) => `
      <tr>
        <td>${item.nombre_producto ?? `Producto #${item.id_producto ?? "—"}`}</td>
        <td style="text-align:right">${item.cantidad}</td>
        <td style="text-align:right">${pesos(item.precio_lista)}</td>
        <td style="text-align:right">${pesos(item.descuento_unitario)}</td>
        <td style="text-align:right">${pesos(item.precio_unitario)}</td>
        <td style="text-align:right">${pesos(item.subtotal)}</td>
      </tr>`
          )
          .join("")
      : `<tr><td colspan="6">No se encontraron productos en el detalle de este pedido.</td></tr>`;
    const ventana = window.open("", "_blank", "width=960,height=900");
    if (!ventana) return;

    ventana.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Factura Pedido #${pedido.id_pedido}</title>
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
      <h2>FACTURA DE VENTA · PEDIDO #${pedido.id_pedido}</h2>
      <p>Fecha: ${fecha(pedido.fecha_pedido)}</p>
      <p>Estado: <strong>${pedido.estado}</strong></p>
    </div>
  </div>

  <div class="caja">
    <h3>Datos del Cliente</h3>
    <div class="grid">
      <div><strong>Cliente:</strong> ${usuario?.nombre ?? "Cliente"}</div>
      <div><strong>Correo:</strong> ${usuario?.correo ?? "—"}</div>
      <div><strong>Pedido:</strong> #${pedido.id_pedido}</div>
      <div><strong>Unidades totales:</strong> ${pedido.total_unidades}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th style="text-align:right">Cantidad</th>
        <th style="text-align:right">Precio lista</th>
        <th style="text-align:right">Descuento</th>
        <th style="text-align:right">Precio final</th>
        <th style="text-align:right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${filas}
    </tbody>
  </table>

  <div class="totales">
    <div><span>Subtotal lista</span><span>${pesos(subtotalLista)}</span></div>
    <div><span>Descuentos</span><span>−${pesos(descuento)}</span></div>
    <div class="total"><span>Total del pedido</span><span>${pesos(total)}</span></div>
  </div>

  <div class="pie">
    <p>Gracias por su compra · Dotaciones Toronto S.A.S.</p>
  </div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`);
    ventana.document.close();
  };

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

                        {pedido.estado === "Entregado" && (
                          <button
                            type="button"
                            className="dt-boton-icono"
                            title="Descargar / Imprimir factura"
                            onClick={() => descargarFacturaPedido(pedido)}
                          >
                            <FileText size={14} />
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

              {detalle.estado === "Entregado" && (
                <button
                  type="button"
                  className="dt-accion-principal"
                  onClick={() => descargarFacturaPedido(detalle)}
                >
                  <FileText size={15} />
                  Descargar / Imprimir PDF
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
