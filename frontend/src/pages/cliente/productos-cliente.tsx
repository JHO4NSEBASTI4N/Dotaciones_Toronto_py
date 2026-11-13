// src/pages/cliente/catalogo.tsx
//
// Catálogo que ve el cliente: solo productos habilitados. El precio que muestra
// ya puede venir con descuento (GET /descuentos/producto/{id}).

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, RefreshCw, Search, Shirt, ShoppingCart, Store, Tag } from "../../components/iconos";

import {
  carrito as apiCarrito,
  descuentos,
  pesos,
  productos,
  traerTodo,
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
}

export default function CatalogoVista() {
  const { usuario } = useSesion();

  const [lista, setLista] = useState<Producto[]>([]);
  const [precios, setPrecios] = useState<Record<number, PrecioProducto>>({});
  const [cargando, setCargando] = useState(true);
  const [agregando, setAgregando] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [cantidades, setCantidades] = useState<Record<number, number>>({});

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
              },
            ] as const;
          } catch {
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

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Mi cuenta"
        titulo="Catálogo"
        descripcion="Dotaciones disponibles para pedir. Los precios están en pesos colombianos con IVA incluido."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "cliente" } : undefined}
        accion={
          <Link to="/cliente/carrito" className="dt-accion-principal">
            <ShoppingCart size={15} />
            Mi carrito
          </Link>
        }
      />

      {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}
      {mensaje && <Aviso tipo="exito" mensaje={mensaje} onCerrar={() => setMensaje("")} />}

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
          <div className="dt-tabla-scroll">
            <table className="dt-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Talla</th>
                  <th>Color</th>
                  <th>Precio</th>
                  <th>Cantidad</th>
                  <th className="dt-columna-acciones">Agregar</th>
                </tr>
              </thead>

              <tbody>
                {filtrados.map((producto) => {
                  const precio = precios[producto.id_producto];
                  const cantidad = cantidades[producto.id_producto] ?? 1;

                  return (
                    <tr key={producto.id_producto}>
                      <td>
                        <div className="dt-identidad-fila">
                          <span className="dt-avatar-fila">
                            <Shirt size={15} />
                          </span>
                          <div>
                            <span className="dt-fila-principal">{producto.nombre}</span>
                            <span className="dt-fila-secundaria">
                              Código #{producto.id_producto}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>{producto.categoria}</td>
                      <td>{producto.talla ?? "—"}</td>
                      <td>{producto.color ?? "—"}</td>

                      <td>
                        <span className="dt-fila-principal">
                          {pesos(precio?.precio_final ?? producto.precio)}
                        </span>
                        {precio?.tiene_descuento && (
                          <span className="dt-fila-secundaria">
                            <s>{pesos(precio.precio_lista)}</s> con descuento
                          </span>
                        )}
                      </td>

                      <td>
                        <div className="dt-acciones-fila" style={{ justifyContent: "flex-start" }}>
                          <button
                            type="button"
                            className="dt-boton-icono"
                            onClick={() => cambiarCantidad(producto.id_producto, -1)}
                            aria-label="Quitar una unidad"
                          >
                            <Minus size={13} />
                          </button>

                          <span style={{ minWidth: 26, textAlign: "center", fontWeight: 700 }}>
                            {cantidad}
                          </span>

                          <button
                            type="button"
                            className="dt-boton-icono"
                            onClick={() => cambiarCantidad(producto.id_producto, 1)}
                            aria-label="Agregar una unidad"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </td>

                      <td>
                        <div className="dt-acciones-fila">
                          <button
                            type="button"
                            className="dt-boton-secundario"
                            disabled={agregando === producto.id_producto}
                            onClick={() => void agregar(producto)}
                          >
                            {agregando === producto.id_producto ? (
                              <span className="dt-spinner" />
                            ) : (
                              <ShoppingCart size={13} />
                            )}
                            Agregar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
      </section>
    </section>
  );
}
