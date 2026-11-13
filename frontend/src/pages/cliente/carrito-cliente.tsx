// src/pages/cliente/carrito.tsx
//
// Carrito del cliente. Al confirmar se crea el pedido (POST /pedidos) y el
// carrito queda vacío en el backend.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, Minus, Plus, RefreshCw, ShoppingCart, Trash2, Truck } from "../../components/iconos";

import { carrito as apiCarrito, numero, pedidos, pesos } from "../../services/api";
import { useSesion } from "../../context/sesion-contexto";
import {
  Aviso,
  BarraListado,
  EncabezadoModulo,
  FilaIndicadores,
  Indicador,
  TablaCargando,
  TablaVacia,
} from "../../components/indicadores";
import type { Carrito } from "../../types";

export default function CarritoVista() {
  const { usuario } = useSesion();
  const navegar = useNavigate();

  const [carro, setCarro] = useState<Carrito | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      setCarro(await apiCarrito.obtener());
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo cargar tu carrito.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const items = carro?.items ?? [];

  const resumen = useMemo(
    () => ({
      unidades: carro?.total_unidades ?? 0,
      subtotal: carro?.subtotal_lista ?? "0",
      descuento: carro?.descuento_total ?? "0",
      total: carro?.total ?? "0",
      ahorro: numero(carro?.descuento_total) > 0,
    }),
    [carro]
  );

  const cambiarCantidad = async (idDetalle: number, cantidad: number) => {
    if (cantidad < 1) return;

    setGuardando(true);
    setError("");

    try {
      setCarro(await apiCarrito.actualizarItem(idDetalle, cantidad));
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo cambiar la cantidad.");
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async (idDetalle: number, nombre: string | null) => {
    const confirmado = window.confirm(`¿Quitar ${nombre ?? "este producto"} del carrito?`);
    if (!confirmado) return;

    setGuardando(true);
    setError("");

    try {
      setCarro(await apiCarrito.quitarItem(idDetalle));
      setMensaje("Producto quitado del carrito.");
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo quitar el producto.");
    } finally {
      setGuardando(false);
    }
  };

  const vaciar = async () => {
    const confirmado = window.confirm("¿Vaciar el carrito completo?");
    if (!confirmado) return;

    setGuardando(true);
    setError("");

    try {
      setCarro(await apiCarrito.vaciar());
      setMensaje("Carrito vaciado.");
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo vaciar el carrito.");
    } finally {
      setGuardando(false);
    }
  };

  /** Confirma el pedido: el backend toma el carrito y lo convierte en pedido. */
  const confirmarPedido = async () => {
    const confirmado = window.confirm(
      `¿Confirmar el pedido por ${pesos(resumen.total)}? Después podrás seguirlo en "Mis pedidos".`
    );
    if (!confirmado) return;

    setGuardando(true);
    setError("");

    try {
      const pedido = await pedidos.crear({});
      setMensaje(`Pedido #${pedido.id_pedido} creado. Te avisaremos cuando salga.`);
      await cargarDatos();
      setTimeout(() => navegar("/cliente/pedidos"), 900);
    } catch (fallo) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo confirmar el pedido. Revisa el stock disponible."
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Mi cuenta"
        titulo="Mi carrito"
        descripcion="Revisa cantidades y precios antes de confirmar. Los descuentos vigentes ya están aplicados."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "cliente" } : undefined}
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
        <Indicador etiqueta="Unidades" valor={resumen.unidades} descripcion="En el carrito" icono={ShoppingCart} tono="azul" cargando={cargando} />
        <Indicador etiqueta="Precio de lista" valor={pesos(resumen.subtotal)} descripcion="Antes de descuentos" icono={ClipboardCheck} tono="morado" cargando={cargando} />
        <Indicador etiqueta="Descuento" valor={pesos(resumen.descuento)} descripcion={resumen.ahorro ? "¡Estás ahorrando!" : "Sin descuentos activos"} icono={Truck} tono={resumen.ahorro ? "verde" : "ambar"} cargando={cargando} />
        <Indicador etiqueta="Total a pagar" valor={pesos(resumen.total)} descripcion="IVA incluido" icono={ShoppingCart} tono="verde" cargando={cargando} />
      </FilaIndicadores>

      <section className="dt-listado">
        <BarraListado
          titulo="Productos en el carrito"
          descripcion={`${items.length} producto(s)`}
          Icono={ShoppingCart}
        >
          {items.length > 0 && (
            <button
              type="button"
              className="dt-boton-secundario"
              onClick={() => void vaciar()}
              disabled={guardando}
            >
              <Trash2 size={13} /> Vaciar
            </button>
          )}
        </BarraListado>

        {cargando ? (
          <TablaCargando mensaje="Consultando tu carrito…" />
        ) : items.length === 0 ? (
          <TablaVacia
            titulo="Tu carrito está vacío"
            mensaje="Agrega productos desde el catálogo para armar tu pedido."
            Icono={ShoppingCart}
            accion={
              <button
                type="button"
                className="dt-accion-principal"
                onClick={() => navegar("/cliente/productos")}
              >
                Ir al catálogo
              </button>
            }
          />
        ) : (
          <>
            <div className="dt-tabla-scroll">
              <table className="dt-tabla">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Talla / color</th>
                    <th>Precio</th>
                    <th>Cantidad</th>
                    <th>Subtotal</th>
                    <th className="dt-columna-acciones">Quitar</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr key={item.id_detalle_carrito}>
                      <td>
                        <span className="dt-fila-principal">{item.nombre ?? "Producto"}</span>
                        {Number(item.descuento_unitario) > 0 && (
                          <span className="dt-fila-secundaria">
                            Descuento unitario {pesos(item.descuento_unitario)}
                          </span>
                        )}
                      </td>

                      <td>
                        {item.talla ?? "—"} / {item.color ?? "—"}
                      </td>

                      <td>
                        <span className="dt-fila-principal">{pesos(item.precio_unitario)}</span>
                        {Number(item.descuento_unitario) > 0 && (
                          <span className="dt-fila-secundaria">
                            <s>{pesos(item.precio_lista)}</s>
                          </span>
                        )}
                      </td>

                      <td>
                        <div className="dt-acciones-fila" style={{ justifyContent: "flex-start" }}>
                          <button
                            type="button"
                            className="dt-boton-icono"
                            disabled={guardando || item.cantidad <= 1}
                            onClick={() =>
                              void cambiarCantidad(item.id_detalle_carrito, item.cantidad - 1)
                            }
                            aria-label="Quitar una unidad"
                          >
                            <Minus size={13} />
                          </button>

                          <span style={{ minWidth: 26, textAlign: "center", fontWeight: 700 }}>
                            {item.cantidad}
                          </span>

                          <button
                            type="button"
                            className="dt-boton-icono"
                            disabled={guardando}
                            onClick={() =>
                              void cambiarCantidad(item.id_detalle_carrito, item.cantidad + 1)
                            }
                            aria-label="Agregar una unidad"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </td>

                      <td>
                        <span className="dt-fila-principal">{pesos(item.subtotal)}</span>
                      </td>

                      <td>
                        <div className="dt-acciones-fila">
                          <button
                            type="button"
                            className="dt-boton-icono dt-boton-peligro"
                            disabled={guardando}
                            onClick={() => void quitar(item.id_detalle_carrito, item.nombre)}
                            title="Quitar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="dt-listado-contexto">
              <span>
                <span className="dt-punto-contexto" />
                Total con descuentos aplicados
              </span>
              <strong>{pesos(resumen.total)}</strong>
            </div>

            <div className="dt-modal-acciones" style={{ borderTop: "1px solid var(--dt-borde)" }}>
              <button
                type="button"
                className="dt-boton-secundario"
                onClick={() => navegar("/cliente/productos")}
              >
                Seguir comprando
              </button>

              <button
                type="button"
                className="dt-accion-principal"
                onClick={() => void confirmarPedido()}
                disabled={guardando}
              >
                {guardando ? <span className="dt-spinner" /> : <ClipboardCheck size={15} />}
                Confirmar pedido
              </button>
            </div>
          </>
        )}
      </section>
    </section>
  );
}
