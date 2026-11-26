// src/pages/cliente/catalogo.tsx
//
// Catálogo que ve el cliente: solo productos habilitados. El precio que muestra
// ya puede venir con descuento (GET /descuentos/producto/{id}).

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Minus, Plus, RefreshCw, Save, Search, Shirt, ShoppingCart, Store, Tag, Trash2 } from "../../components/iconos";

import {
  carrito as apiCarrito,
  descuentos,
  ErrorApi,
  pedidos,
  pesos,
  productos,
  traerTodo,
  urlImagenProducto,
} from "../../services/api";
import { useSesion } from "../../context/sesion-contexto";
import {
  Aviso,
  BarraListado,
  CajaBusqueda,
  EncabezadoModulo,
  FiltroEstado,
  FilaIndicadores,
  Indicador,
  TablaCargando,
  TablaVacia,
} from "../../components/indicadores";
import type { Producto } from "../../types";

interface PrecioProducto {
  precio_lista: number;
  precio_final: number;
  tiene_descuento: boolean;
  texto_descuento?: string;
}

type ItemEdicionPedido = {
  id_producto: number;
  nombre_producto: string | null;
  cantidad: number;
  precio_lista: string | number;
  descuento_unitario: string | number;
  precio_unitario: string | number;
};

type EstadoEdicionCatalogo = {
  editarPedido?: { id_pedido: number; items: ItemEdicionPedido[] };
} | null;

export default function CatalogoVista() {
  const { usuario } = useSesion();
  const navegar = useNavigate();
  const location = useLocation();
  const entradaEdicion = (location.state as EstadoEdicionCatalogo)?.editarPedido;

  const [lista, setLista] = useState<Producto[]>([]);
  const [precios, setPrecios] = useState<Record<number, PrecioProducto>>({});
  const [cargando, setCargando] = useState(true);
  const [agregando, setAgregando] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [pedidoEditandoId] = useState<number | null>(entradaEdicion?.id_pedido ?? null);
  const [itemsPedido, setItemsPedido] = useState<ItemEdicionPedido[]>(() => entradaEdicion?.items ?? []);
  const [guardandoPedido, setGuardandoPedido] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState("");

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const datos = await traerTodo((saltar, limite) => productos.listar({ saltar, limite }));
      const activos = datos.items.filter((producto) => !producto.inhabilitado);
      setLista(activos);

      // Precio con descuento vigente, producto por producto.
      const pares = await Promise.all(
        activos.map(async (producto) => {
          try {
            const vigente = await descuentos.deProducto(producto.id_producto);
            return [
              producto.id_producto,
              {
                precio_lista: Number(vigente.precio_lista),
                precio_final: Number(vigente.precio_unitario),
                tiene_descuento: Boolean(vigente.descuento),
                texto_descuento: vigente.descuento.tipo_descuento === "PORCENTAJE"
                  ? `${Number(vigente.descuento.valor_descuento)}% de descuento`
                  : `${pesos(vigente.descuento.valor_descuento)} de descuento`,
              },
            ] as const;
          } catch (fallo) {
            if (!(fallo instanceof ErrorApi && fallo.estado === 404)) throw fallo;
            return [
              producto.id_producto,
              {
                precio_lista: Number(producto.precio),
                precio_final: Number(producto.precio),
                tiene_descuento: false,
              },
            ] as const;
          }
        })
      );

      setPrecios(Object.fromEntries(pares));
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo cargar el catálogo.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const categorias = useMemo(
    () => Array.from(new Set(lista.map((producto) => producto.categoria))).sort(),
    [lista]
  );

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return lista.filter((producto) => {
      const coincideTexto =
        !texto ||
        producto.nombre.toLowerCase().includes(texto) ||
        (producto.talla ?? "").toLowerCase().includes(texto) ||
        (producto.color ?? "").toLowerCase().includes(texto);

      const coincideCategoria = !filtroCategoria || producto.categoria === filtroCategoria;

      return coincideTexto && coincideCategoria;
    });
  }, [lista, busqueda, filtroCategoria]);

  const conDescuento = useMemo(
    () => Object.values(precios).filter((precio) => precio.tiene_descuento).length,
    [precios]
  );

  const cambiarCantidad = (idProducto: number, delta: number) => {
    setCantidades((previas) => {
      const actual = previas[idProducto] ?? 1;
      return { ...previas, [idProducto]: Math.max(1, actual + delta) };
    });
  };

  const agregar = async (producto: Producto) => {
    setAgregando(producto.id_producto);
    setError("");

    try {
      await apiCarrito.agregar(producto.id_producto, cantidades[producto.id_producto] ?? 1);
      setMensaje(`${producto.nombre} se agregó a tu carrito.`);
      setCantidades((previas) => ({ ...previas, [producto.id_producto]: 1 }));
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo agregar al carrito.");
    } finally {
      setAgregando(null);
    }
  };

  const cambiarCantidadPedido = (idProducto: number, delta: number) => {
    setItemsPedido((actuales) => actuales.map((item) =>
      item.id_producto === idProducto
        ? { ...item, cantidad: Math.max(1, item.cantidad + delta) }
        : item
    ));
  };

  const agregarAlPedido = (producto: Producto) => {
    setItemsPedido((actuales) => {
      const existente = actuales.find((item) => item.id_producto === producto.id_producto);
      if (existente) {
        return actuales.map((item) => item.id_producto === producto.id_producto
          ? { ...item, cantidad: item.cantidad + 1 }
          : item);
      }
      const precio = precios[producto.id_producto];
      return [...actuales, {
        id_producto: producto.id_producto,
        nombre_producto: producto.nombre,
        cantidad: 1,
        precio_lista: precio?.precio_lista ?? Number(producto.precio),
        descuento_unitario: precio ? precio.precio_lista - precio.precio_final : 0,
        precio_unitario: precio?.precio_final ?? Number(producto.precio),
      }];
    });
    setErrorEdicion("");
  };

  const quitarDelPedido = (idProducto: number) => {
    setItemsPedido((actuales) => actuales.filter((item) => item.id_producto !== idProducto));
    setErrorEdicion("");
  };

  const guardarPedidoEditado = async () => {
    if (!pedidoEditandoId) return;
    if (itemsPedido.length === 0) {
      setErrorEdicion("Agrega por lo menos un producto. Si ya no necesitas este pedido, puedes cancelarlo desde Mis pedidos.");
      return;
    }
    setGuardandoPedido(true);
    setErrorEdicion("");
    try {
      await pedidos.actualizarItems(
        pedidoEditandoId,
        itemsPedido.map(({ id_producto, cantidad }) => ({ id_producto, cantidad }))
      );
      navegar("/cliente/pedidos", {
        state: { mensaje: `El pedido #${pedidoEditandoId} se actualizó correctamente.` },
      });
    } catch (fallo) {
      setErrorEdicion(fallo instanceof Error ? fallo.message : "No se pudo guardar el pedido.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setGuardandoPedido(false);
    }
  };

  const totalEstimadoPedido = itemsPedido.reduce(
    (total, item) => total + Number(item.precio_unitario) * item.cantidad,
    0
  );
  const unidadesPedido = itemsPedido.reduce((total, item) => total + item.cantidad, 0);

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Mi cuenta"
        titulo={pedidoEditandoId ? `Editar pedido #${pedidoEditandoId}` : "Catálogo"}
        descripcion={pedidoEditandoId
          ? "Explora las dotaciones y actualiza tu pedido pendiente con controles visuales y precios claros."
          : "Dotaciones disponibles para pedir. Los precios están en pesos colombianos con IVA incluido."}
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "cliente" } : undefined}
        accion={pedidoEditandoId ? (
          <button type="button" className="dt-boton-secundario" onClick={() => navegar("/cliente/pedidos")}>
            <ArrowLeft size={15} /> Volver a mis pedidos
          </button>
        ) : (
          <Link to="/cliente/carrito" className="dt-accion-principal">
            <ShoppingCart size={15} />
            Mi carrito
          </Link>
        )}
      />

      {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}
      {mensaje && <Aviso tipo="exito" mensaje={mensaje} onCerrar={() => setMensaje("")} />}
      {errorEdicion && <Aviso tipo="error" mensaje={errorEdicion} onCerrar={() => setErrorEdicion("")} />}

      {pedidoEditandoId && (
        <section style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
          flexWrap: "wrap", padding: "18px 20px", marginBottom: 18, borderRadius: 16,
          border: "1px solid #c7d2fe", background: "linear-gradient(120deg, #eef2ff, #f8fafc)",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#3730a3", fontWeight: 750 }}>
              <Check size={17} /> Estás personalizando el pedido #{pedidoEditandoId}
            </div>
            <p style={{ margin: "5px 0 0", color: "#475569", fontSize: 13 }}>
              En las tarjetas puedes ajustar unidades, quitar artículos o sumar productos del catálogo.
            </p>
          </div>
          <div style={{ display: "flex", gap: 18, alignItems: "center", color: "#334155", fontSize: 13 }}>
            <span><strong>{itemsPedido.length}</strong> productos</span>
            <span><strong>{unidadesPedido}</strong> unidades</span>
            <strong style={{ color: "#111827", fontSize: 17 }}>{pesos(totalEstimadoPedido)}</strong>
          </div>
        </section>
      )}

      <FilaIndicadores>
        <Indicador etiqueta="Productos" valor={lista.length} descripcion="Disponibles para pedir" icono={Store} tono="azul" cargando={cargando} />
        <Indicador etiqueta="Categorías" valor={categorias.length} descripcion="Tipos de dotación" icono={Tag} tono="morado" cargando={cargando} />
        <Indicador etiqueta="Con descuento" valor={conDescuento} descripcion="Precio rebajado vigente" icono={Tag} tono="verde" cargando={cargando} />
      </FilaIndicadores>

      <section className="dt-listado">
        <BarraListado
          titulo="Productos"
          descripcion={`${filtrados.length} de ${lista.length} disponibles`}
          Icono={Shirt}
        >
          <CajaBusqueda valor={busqueda} onCambio={setBusqueda} marcador="Nombre, talla o color" />

          <FiltroEstado
            valor={filtroCategoria}
            onCambio={setFiltroCategoria}
            opciones={[
              { valor: "", texto: "Todas las categorías" },
              ...categorias.map((categoria) => ({ valor: categoria, texto: categoria })),
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
          <TablaCargando mensaje="Cargando el catálogo…" />
        ) : filtrados.length === 0 ? (
          <TablaVacia
            titulo="No hay productos con ese filtro"
            mensaje="Prueba con otra categoría o borra la búsqueda."
            Icono={Search}
          />
        ) : (
          <div className="dt-productos-grid">
            {filtrados.map((producto) => {
              const precio = precios[producto.id_producto];
              const cantidad = cantidades[producto.id_producto] ?? 1;
              const itemPedido = itemsPedido.find((item) => item.id_producto === producto.id_producto);

              return (
                <article className="dt-producto-card" key={producto.id_producto}>
                  <div className="dt-producto-card-imagen">
                    {producto.imagen ? (
                      <img
                        src={urlImagenProducto(producto.imagen)}
                        alt={producto.nombre}
                        loading="lazy"
                      />
                    ) : (
                      <div className="dt-producto-sin-imagen" aria-label="Sin imagen">
                        <Shirt size={42} strokeWidth={1.4} />
                      </div>
                    )}
                    <span className="dt-producto-categoria">
                      {producto.categoria || "Dotación"}
                    </span>
                    {pedidoEditandoId && itemPedido && (
                      <span className="dt-producto-descuento">En el pedido · {itemPedido.cantidad}</span>
                    )}
                    {!pedidoEditandoId && precio?.tiene_descuento && (
                      <span className="dt-producto-descuento">{precio.texto_descuento || "Oferta"}</span>
                    )}
                  </div>

                  <div className="dt-producto-card-cuerpo">
                    <div className="dt-producto-titulo">
                      <h3>{producto.nombre}</h3>
                      <span>Código #{producto.id_producto}</span>
                    </div>

                    <div className="dt-producto-atributos">
                      <span>Talla <strong>{producto.talla || "Única"}</strong></span>
                      <span>Color <strong>{producto.color || "—"}</strong></span>
                    </div>

                    <div className="dt-producto-precio">
                      <div>
                        <span className="dt-producto-precio-etiqueta">
                          {pedidoEditandoId && itemPedido ? "Precio congelado del pedido" : "Precio unitario"}
                        </span>
                        {(!pedidoEditandoId || !itemPedido) && precio?.tiene_descuento && (
                          <s>{pesos(precio.precio_lista)}</s>
                        )}
                        <strong>{pedidoEditandoId && itemPedido
                          ? pesos(itemPedido.precio_unitario)
                          : pesos(precio?.precio_final ?? producto.precio)}</strong>
                      </div>
                      {(!pedidoEditandoId || !itemPedido) && precio?.tiene_descuento && (
                        <Tag size={17} aria-label="Precio con descuento" />
                      )}
                    </div>

                    {pedidoEditandoId ? (
                      <div className="dt-producto-compra">
                        {itemPedido ? (
                          <>
                            <div className="dt-producto-cantidad" aria-label={`Cantidad de ${producto.nombre} en el pedido`}>
                              <button
                                type="button"
                                className="dt-boton-icono"
                                onClick={() => cambiarCantidadPedido(producto.id_producto, -1)}
                                disabled={guardandoPedido}
                                aria-label={`Quitar una unidad de ${producto.nombre}`}
                              ><Minus size={13} /></button>
                              <span>{itemPedido.cantidad}</span>
                              <button
                                type="button"
                                className="dt-boton-icono"
                                onClick={() => cambiarCantidadPedido(producto.id_producto, 1)}
                                disabled={guardandoPedido}
                                aria-label={`Agregar una unidad de ${producto.nombre}`}
                              ><Plus size={13} /></button>
                            </div>
                            <button
                              type="button"
                              className="dt-boton-secundario"
                              onClick={() => quitarDelPedido(producto.id_producto)}
                              disabled={guardandoPedido}
                              title={`Quitar ${producto.nombre} del pedido`}
                            ><Trash2 size={14} /> Quitar</button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="dt-producto-agregar"
                            onClick={() => agregarAlPedido(producto)}
                            disabled={guardandoPedido}
                          ><Plus size={15} /> Sumar al pedido</button>
                        )}
                      </div>
                    ) : (
                      <div className="dt-producto-compra">
                        <div className="dt-producto-cantidad" aria-label="Cantidad a agregar">
                          <button
                            type="button"
                            className="dt-boton-icono"
                            onClick={() => cambiarCantidad(producto.id_producto, -1)}
                            aria-label={`Quitar una unidad de ${producto.nombre}`}
                          >
                            <Minus size={13} />
                          </button>
                          <span>{cantidad}</span>
                          <button
                            type="button"
                            className="dt-boton-icono"
                            onClick={() => cambiarCantidad(producto.id_producto, 1)}
                            aria-label={`Agregar una unidad de ${producto.nombre}`}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        <button
                          type="button"
                          className="dt-producto-agregar"
                          disabled={agregando === producto.id_producto}
                          onClick={() => void agregar(producto)}
                        >
                          {agregando === producto.id_producto ? (
                            <span className="dt-spinner" />
                          ) : (
                            <ShoppingCart size={15} />
                          )}
                          Agregar
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="dt-listado-contexto">
          <span>
            <span className="dt-punto-contexto" />
            Los precios ya incluyen IVA (19 %)
          </span>
          <span className="dt-listado-contexto-secundario">
            Stock sujeto a disponibilidad de bodega
          </span>
        </div>

        {pedidoEditandoId && (
          <div style={{
            position: "sticky", bottom: 12, zIndex: 5, marginTop: 18,
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14,
            flexWrap: "wrap", padding: "14px 18px", borderRadius: 16,
            background: "rgba(15, 23, 42, .96)", color: "white",
            boxShadow: "0 12px 30px rgba(15, 23, 42, .24)", backdropFilter: "blur(12px)",
          }}>
            <div>
              <div style={{ fontWeight: 750 }}>{itemsPedido.length} productos · {unidadesPedido} unidades</div>
              <div style={{ color: "#cbd5e1", fontSize: 12, marginTop: 3 }}>Total estimado: {pesos(totalEstimadoPedido)}</div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ color: "#cbd5e1", fontSize: 12 }}>El inventario se verifica al guardar.</span>
              <button
                type="button"
                className="dt-accion-principal"
                onClick={() => void guardarPedidoEditado()}
                disabled={guardandoPedido || itemsPedido.length === 0}
              >
                {guardandoPedido ? <span className="dt-spinner" /> : <Save size={15} />}
                {guardandoPedido ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
