// src/pages/bodeguero/inventario.tsx
//
// Inventario por producto. Entradas y salidas se registran con los endpoints
// /inventario/{id}/entrada, /salida y /ajuste; cada operación deja movimiento.

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Boxes, Clock, Package, Plus, RefreshCw, SlidersHorizontal, TriangleAlert, X } from "../../components/iconos";

import { inventario, productos as apiProductos, traerTodo } from "../../services/api";
import { useSesion } from "../../context/sesion-contexto";
import {
  Aviso,
  BarraListado,
  CajaBusqueda,
  EncabezadoModulo,
  EtiquetaEstado,
  fecha,
  FiltroEstado,
  FilaIndicadores,
  Indicador,
  TablaCargando,
  TablaVacia,
} from "../../components/indicadores";
import type { Inventario, MovimientoInventario, Producto, StockPorProducto } from "../../types";

type Operacion = "entrada" | "salida" | "ajuste";

export default function InventarioVista() {
  const { usuario } = useSesion();
  const esAdministrador = usuario?.id_rol === 1;

  const [stock, setStock] = useState<StockPorProducto[]>([]);
  const [filas, setFilas] = useState<Inventario[]>([]);
  const [catalogoProductos, setCatalogoProductos] = useState<Producto[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("");
  const [vista, setVista] = useState<"stock" | "historial">("stock");

  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [idProductoNuevo, setIdProductoNuevo] = useState("");
  const [cantidadInicial, setCantidadInicial] = useState("0");
  const [minimoInicial, setMinimoInicial] = useState("0");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [producto, setProducto] = useState<StockPorProducto | null>(null);
  const [operacion, setOperacion] = useState<Operacion>("entrada");
  const [cantidad, setCantidad] = useState("1");
  const [motivo, setMotivo] = useState("");
  const [idInventario, setIdInventario] = useState("");

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const [existencias, detalle, productosActivos, historial] = await Promise.all([
        traerTodo((saltar, limite) => inventario.stock(saltar, limite)),
        traerTodo((saltar, limite) => inventario.listar(saltar, limite)),
        traerTodo((saltar, limite) => apiProductos.listar({ saltar, limite })),
        inventario.movimientos(0, 50),
      ]);

      setStock(existencias.items);
      setFilas(detalle.items);
      setCatalogoProductos(productosActivos.items);
      setMovimientos(historial.items);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo cargar el inventario.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const resumen = useMemo(() => {
    const activos = stock.filter((fila) => !fila.inhabilitado);

    return {
      productos: activos.length,
      unidades: activos.reduce((suma, fila) => suma + fila.stock_total, 0),
      bajoMinimo: activos.filter((fila) => fila.bajo_minimo).length,
      agotados: activos.filter((fila) => fila.stock_total === 0).length,
    };
  }, [stock]);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return stock.filter((fila) => {
      const coincideTexto =
        !texto ||
        fila.nombre.toLowerCase().includes(texto) ||
        (fila.categoria ?? "").toLowerCase().includes(texto) ||
        (fila.talla ?? "").toLowerCase().includes(texto);

      const coincideFiltro =
        !filtro ||
        (filtro === "bajo" && fila.bajo_minimo) ||
        (filtro === "agotado" && fila.stock_total === 0) ||
        (filtro === "ok" && !fila.bajo_minimo && fila.stock_total > 0);

      return coincideTexto && coincideFiltro;
    });
  }, [stock, busqueda, filtro]);

  const productosDisponibles = useMemo(() => {
    const idsRegistrados = new Set(
      filas
        .map((fila) => fila.id_producto_fk)
        .filter((id): id is number => id !== null)
    );
    return catalogoProductos.filter(
      (item) => !item.inhabilitado && !idsRegistrados.has(item.id_producto)
    );
  }, [catalogoProductos, filas]);

  const abrirCrearInventario = () => {
    setError("");
    setIdProductoNuevo(productosDisponibles[0] ? String(productosDisponibles[0].id_producto) : "");
    setCantidadInicial("0");
    setMinimoInicial("0");
    setModalCrearAbierto(true);
  };

  const guardarNuevoInventario = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!idProductoNuevo) return;

    setGuardando(true);
    setError("");
    try {
      const seleccionado = productosDisponibles.find(
        (item) => item.id_producto === Number(idProductoNuevo)
      );
      await inventario.crear({
        id_producto_fk: Number(idProductoNuevo),
        cantidad_actual: Number(cantidadInicial),
        stock_minimo: Number(minimoInicial),
      });
      setMensaje(`Inventario inicial de ${seleccionado?.nombre ?? "producto"} registrado.`);
      setModalCrearAbierto(false);
      await cargarDatos();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo crear el inventario.");
    } finally {
      setGuardando(false);
    }
  };

  const filasDelProducto = (idProducto: number) =>
    filas.filter((fila) => fila.id_producto_fk === idProducto && !fila.inhabilitado);

  const abrirOperacion = (fila: StockPorProducto, tipo: Operacion) => {
    const propias = filasDelProducto(fila.id_producto);

    setProducto(fila);
    setOperacion(tipo);
    setCantidad(tipo === "ajuste" ? String(fila.stock_total) : "1");
    setMotivo("");
    setIdInventario(propias.length === 1 ? String(propias[0].id_inventario) : "");
    setError("");
    setModalAbierto(true);
  };

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    setGuardando(true);
    setError("");

    try {
      const id = Number(idInventario);

      if (operacion === "entrada") {
        await inventario.entrada(id, Number(cantidad), motivo || "Ingreso a bodega");
      } else if (operacion === "salida") {
        await inventario.salida(id, Number(cantidad), motivo || "Salida de bodega");
      } else {
        await inventario.ajuste(id, Number(cantidad), motivo || "Ajuste de conteo");
      }

      setMensaje(
        `Se registró ${operacion} de ${cantidad} unidad(es) en ${producto?.nombre}.`
      );
      setModalAbierto(false);
      await cargarDatos();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo registrar el movimiento.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion={esAdministrador ? "Administración" : "Bodega"}
        titulo="Inventario"
        descripcion="Registra inventarios iniciales, controla existencias y consulta los movimientos de bodega."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: esAdministrador ? "admin" : "bodeguero" } : undefined}
        accion={
          <div className="dt-acciones-inventario">
            <button
              type="button"
              className="dt-accion-principal"
              onClick={abrirCrearInventario}
              disabled={cargando}
            >
              <Plus size={15} />
              Agregar inventario
            </button>
            <button
              type="button"
              className="dt-boton-secundario"
              onClick={() => void cargarDatos()}
              disabled={cargando}
            >
              <RefreshCw size={15} className={cargando ? "dt-girando" : ""} />
              Actualizar
            </button>
          </div>
        }
      />

      {error && !modalCrearAbierto && !modalAbierto && (
        <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />
      )}
      {mensaje && <Aviso tipo="exito" mensaje={mensaje} onCerrar={() => setMensaje("")} />}

      <FilaIndicadores>
        <Indicador etiqueta="Productos" valor={resumen.productos} descripcion="Con registro de inventario" icono={Package} tono="azul" cargando={cargando} />
        <Indicador etiqueta="Unidades" valor={resumen.unidades} descripcion="Disponibles en total" icono={Boxes} tono="verde" cargando={cargando} />
        <Indicador etiqueta="Bajo mínimo" valor={resumen.bajoMinimo} descripcion="Requieren reposición" icono={TriangleAlert} tono="ambar" cargando={cargando} />
        <Indicador etiqueta="Agotados" valor={resumen.agotados} descripcion="Sin unidades" icono={TriangleAlert} tono="rojo" cargando={cargando} />
      </FilaIndicadores>

      <div className="dt-inventario-pestanas" role="tablist" aria-label="Vistas de inventario">
        <button
          type="button"
          role="tab"
          aria-selected={vista === "stock"}
          className={vista === "stock" ? "dt-inventario-pestana activa" : "dt-inventario-pestana"}
          onClick={() => setVista("stock")}
        >
          <Boxes size={15} /> Stock actual
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={vista === "historial"}
          className={vista === "historial" ? "dt-inventario-pestana activa" : "dt-inventario-pestana"}
          onClick={() => setVista("historial")}
        >
          <Clock size={15} /> Historial de movimientos
        </button>
      </div>

      {vista === "stock" ? (
      <section className="dt-listado">
        <BarraListado
          titulo="Existencias"
          descripcion={`${filtrados.length} de ${stock.length} productos`}
          Icono={Boxes}
        >
          <CajaBusqueda valor={busqueda} onCambio={setBusqueda} marcador="Producto, categoría o talla" />

          <FiltroEstado
            valor={filtro}
            onCambio={setFiltro}
            opciones={[
              { valor: "", texto: "Todo el inventario" },
              { valor: "ok", texto: "Con stock" },
              { valor: "bajo", texto: "Bajo mínimo" },
              { valor: "agotado", texto: "Agotados" },
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
          <TablaCargando mensaje="Consultando existencias…" />
        ) : filtrados.length === 0 ? (
          <TablaVacia
            titulo="Sin registros de inventario"
            mensaje="Ajusta la búsqueda o registra el inventario inicial de un producto."
            Icono={Boxes}
          />
        ) : (
          <div className="dt-tabla-scroll">
            <table className="dt-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Talla / color</th>
                  <th>Stock</th>
                  <th>Mínimo</th>
                  <th>Estado</th>
                  <th className="dt-columna-acciones">Movimientos</th>
                </tr>
              </thead>

              <tbody>
                {filtrados.map((fila) => (
                  <tr key={fila.id_producto}>
                    <td>
                      <div className="dt-identidad-fila">
                        <span className="dt-avatar-fila">
                          <Package size={15} />
                        </span>
                        <div>
                          <span className="dt-fila-principal">{fila.nombre}</span>
                          <span className="dt-fila-secundaria">
                            {fila.filas_inventario} fila(s) de inventario
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>{fila.categoria ?? "—"}</td>
                    <td>
                      {fila.talla ?? "—"} / {fila.color ?? "—"}
                    </td>
                    <td>
                      <span className="dt-fila-principal">{fila.stock_total}</span>
                    </td>
                    <td>{fila.stock_minimo}</td>

                    <td>
                      <EtiquetaEstado
                        tipo={
                          fila.stock_total === 0
                            ? "inactivo"
                            : fila.bajo_minimo
                              ? "pendiente"
                              : "activo"
                        }
                        texto={
                          fila.stock_total === 0
                            ? "Agotado"
                            : fila.bajo_minimo
                              ? "Bajo mínimo"
                              : "Disponible"
                        }
                      />
                    </td>

                    <td>
                      <div className="dt-acciones-fila">
                        <button
                          type="button"
                          className="dt-boton-icono"
                          title="Registrar entrada"
                          onClick={() => abrirOperacion(fila, "entrada")}
                        >
                          <ArrowDownToLine size={14} />
                        </button>

                        <button
                          type="button"
                          className="dt-boton-icono"
                          title="Registrar salida"
                          onClick={() => abrirOperacion(fila, "salida")}
                        >
                          <ArrowUpFromLine size={14} />
                        </button>

                        <button
                          type="button"
                          className="dt-boton-icono"
                          title="Ajustar conteo"
                          onClick={() => abrirOperacion(fila, "ajuste")}
                        >
                          <SlidersHorizontal size={14} />
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
      ) : (
        <section className="dt-listado">
          <BarraListado
            titulo="Historial de movimientos"
            descripcion={`${movimientos.length} movimiento(s) registrados`}
            Icono={Clock}
          />
          {cargando ? (
            <TablaCargando mensaje="Consultando el historial…" />
          ) : movimientos.length === 0 ? (
            <TablaVacia
              titulo="Sin movimientos registrados"
              mensaje="Las entradas, salidas y ajustes de inventario aparecerán aquí."
              Icono={Clock}
            />
          ) : (
            <div className="dt-tabla-scroll">
              <table className="dt-tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th>Movimiento</th>
                    <th>Cantidad</th>
                    <th>Motivo</th>
                    <th>Responsable</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((movimiento) => {
                    const tipo = movimiento.tipo_movimiento ?? "AJUSTE";
                    const cantidadMovimiento = movimiento.cantidad ?? 0;
                    const cantidadTexto =
                      tipo === "SALIDA"
                        ? `−${Math.abs(cantidadMovimiento)}`
                        : tipo === "ENTRADA"
                          ? `+${Math.abs(cantidadMovimiento)}`
                          : `${cantidadMovimiento > 0 ? "+" : ""}${cantidadMovimiento}`;

                    return (
                      <tr key={movimiento.id}>
                        <td>{fecha(movimiento.fecha_hora)}</td>
                        <td><strong>{movimiento.nombre_producto ?? "Producto"}</strong></td>
                        <td>
                          <EtiquetaEstado
                            tipo={tipo === "ENTRADA" ? "activo" : tipo === "SALIDA" ? "inactivo" : "pendiente"}
                            texto={tipo === "ENTRADA" ? "Entrada" : tipo === "SALIDA" ? "Salida" : "Ajuste"}
                          />
                        </td>
                        <td><strong>{cantidadTexto}</strong></td>
                        <td>{movimiento.motivo ?? "Sin motivo"}</td>
                        <td>{movimiento.usuario_responsable ?? "Sistema"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {modalCrearAbierto && (
        <div
          className="dt-modal-fondo"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget && !guardando) setModalCrearAbierto(false);
          }}
        >
          <section className="dt-modal" role="dialog" aria-modal="true" aria-labelledby="titulo-crear-inventario">
            <header className="dt-modal-encabezado">
              <span className="dt-modal-icono"><Plus size={21} /></span>
              <div className="dt-modal-titulo-grupo">
                <span className="dt-migas">Registro inicial</span>
                <h2 id="titulo-crear-inventario">Agregar inventario</h2>
                <p>Selecciona un producto y define su stock actual y mínimo.</p>
              </div>
              <button
                type="button"
                className="dt-boton-cerrar-modal"
                onClick={() => setModalCrearAbierto(false)}
                disabled={guardando}
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </header>

            {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}

            <form onSubmit={guardarNuevoInventario}>
              <div className="dt-formulario-contenido">
                {productosDisponibles.length === 0 ? (
                  <p className="dt-inventario-sin-productos">
                    No hay productos activos sin inventario. Cada producto puede tener un solo registro; revisa el catálogo o los registros existentes.
                  </p>
                ) : (
                  <div className="dt-formulario-grid">
                    <label className="dt-campo-ancho">
                      Producto <span>*</span>
                      <select
                        value={idProductoNuevo}
                        onChange={(evento) => setIdProductoNuevo(evento.target.value)}
                        required
                        disabled={guardando}
                      >
                        <option value="">Selecciona un producto</option>
                        {productosDisponibles.map((item) => (
                          <option key={item.id_producto} value={item.id_producto}>
                            {[item.nombre, item.talla, item.color].filter(Boolean).join(" · ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="dt-campo-ancho">
                      Cantidad inicial <span>*</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={cantidadInicial}
                        onChange={(evento) => setCantidadInicial(evento.target.value)}
                        required
                        disabled={guardando}
                      />
                    </label>
                    <label className="dt-campo-ancho">
                      Stock mínimo de reposición <span>*</span>
                      <input
                        id="stock-minimo-inicial"
                        type="number"
                        min={0}
                        step={1}
                        value={minimoInicial}
                        onChange={(evento) => setMinimoInicial(evento.target.value)}
                        required
                        disabled={guardando}
                        aria-describedby="ayuda-stock-minimo-inicial"
                      />
                      <small id="ayuda-stock-minimo-inicial">
                        Si las existencias llegan a este número, el sistema marcará el stock como bajo.
                      </small>
                    </label>
                  </div>
                )}
              </div>
              <footer className="dt-modal-acciones">
                <button
                  type="button"
                  className="dt-boton-secundario"
                  onClick={() => setModalCrearAbierto(false)}
                  disabled={guardando}
                >Cancelar</button>
                <button
                  type="submit"
                  className="dt-accion-principal"
                  disabled={guardando || productosDisponibles.length === 0}
                >
                  {guardando ? <span className="dt-spinner" /> : <Plus size={15} />}
                  Guardar registro
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {modalAbierto && producto && (
        <div
          className="dt-modal-fondo"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setModalAbierto(false);
          }}
        >
          <section className="dt-modal" style={{ maxWidth: 540 }} role="dialog" aria-modal="true">
            <header className="dt-modal-encabezado">
              <span className="dt-modal-icono">
                {operacion === "entrada" ? (
                  <ArrowDownToLine size={21} />
                ) : operacion === "salida" ? (
                  <ArrowUpFromLine size={21} />
                ) : (
                  <SlidersHorizontal size={21} />
                )}
              </span>

              <div className="dt-modal-titulo-grupo">
                <span className="dt-migas">{operacion}</span>
                <h2>{producto.nombre}</h2>
                <p>
                  Stock actual {producto.stock_total} · mínimo {producto.stock_minimo}
                </p>
              </div>

              <button
                type="button"
                className="dt-boton-cerrar-modal"
                onClick={() => setModalAbierto(false)}
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </header>

            {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}

            <form onSubmit={guardar}>
              <div className="dt-formulario-contenido">
                <div className="dt-formulario-grid">
                  <label className="dt-campo-ancho">
                    Fila de inventario <span>*</span>
                    <select
                      value={idInventario}
                      onChange={(e) => setIdInventario(e.target.value)}
                      required
                    >
                      <option value="">Selecciona talla y color</option>
                      {filasDelProducto(producto.id_producto).map((fila) => (
                        <option key={fila.id_inventario} value={fila.id_inventario}>
                          Inventario #{fila.id_inventario} · hay {fila.cantidad_actual ?? 0} ·
                          mínimo {fila.stock_minimo ?? 0}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    {operacion === "ajuste" ? "Conteo real" : "Cantidad"} <span>*</span>
                    <input
                      type="number"
                      min={operacion === "ajuste" ? 0 : 1}
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                      required
                    />
                  </label>

                  <label>
                    Motivo
                    <input
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Compra a proveedor, daño, conteo físico…"
                    />
                  </label>
                </div>
              </div>

              <footer className="dt-modal-acciones">
                <button
                  type="button"
                  className="dt-boton-secundario"
                  onClick={() => setModalAbierto(false)}
                  disabled={guardando}
                >
                  Cancelar
                </button>

                <button type="submit" className="dt-accion-principal" disabled={guardando}>
                  {guardando ? <span className="dt-spinner" /> : <Boxes size={15} />}
                  Registrar {operacion}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
