// src/pages/admin/productos.tsx
//
// Catálogo de dotaciones. No hay DELETE: se inhabilita y se puede rehabilitar.

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Package, PackageMinus, PackagePlus, Pencil, Plus, RefreshCw, Shirt, Tag, X } from "../../components/iconos";

import { pesos, productos, traerTodo, urlImagenProducto } from "../../services/api";
import { useSesion } from "../../context/sesion-contexto";
import {
  Aviso,
  BarraListado,
  CajaBusqueda,
  EncabezadoModulo,
  EtiquetaActivo,
  FiltroEstado,
  FilaIndicadores,
  Indicador,
  TablaCargando,
  TablaVacia,
} from "../../components/indicadores";
import type { Producto } from "../../types";

interface Formulario {
  nombre: string;
  precio: string;
  categoria: string;
  talla: string;
  color: string;
  imagen: string;
}

const FORMULARIO_VACIO: Formulario = {
  nombre: "",
  precio: "",
  categoria: "",
  talla: "",
  color: "",
  imagen: "",
};

export default function ProductosAdmin() {
  const { usuario } = useSesion();

  const [lista, setLista] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [soloInactivos, setSoloInactivos] = useState("");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [formulario, setFormulario] = useState<Formulario>(FORMULARIO_VACIO);
  const [archivoImagen, setArchivoImagen] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState("");

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const datos = await traerTodo((saltar, limite) =>
        productos.listar({ saltar, limite, incluir_inhabilitados: true })
      );
      setLista(datos.items);
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

  const resumen = useMemo(
    () => ({
      total: lista.length,
      activos: lista.filter((p) => !p.inhabilitado).length,
      inactivos: lista.filter((p) => p.inhabilitado).length,
      categorias: categorias.length,
    }),
    [lista, categorias]
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

      const coincideEstado =
        !soloInactivos ||
        (soloInactivos === "activos" && !producto.inhabilitado) ||
        (soloInactivos === "inactivos" && producto.inhabilitado);

      return coincideTexto && coincideCategoria && coincideEstado;
    });
  }, [lista, busqueda, filtroCategoria, soloInactivos]);

  const abrirNuevo = () => {
    setEditando(null);
    setFormulario(FORMULARIO_VACIO);
    setArchivoImagen(null);
    setVistaPrevia("");
    setError("");
    setModalAbierto(true);
  };

  const abrirEdicion = (producto: Producto) => {
    setEditando(producto);
    setFormulario({
      nombre: producto.nombre,
      precio: String(Number(producto.precio)),
      categoria: producto.categoria,
      talla: producto.talla ?? "",
      color: producto.color ?? "",
      imagen: producto.imagen ?? "",
    });
    setArchivoImagen(null);
    setVistaPrevia(urlImagenProducto(producto.imagen));
    setError("");
    setModalAbierto(true);
  };

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    setGuardando(true);
    setError("");

    const datos = {
      nombre: formulario.nombre,
      precio: Number(formulario.precio),
      categoria: formulario.categoria,
      talla: formulario.talla || null,
      color: formulario.color || null,
      imagen: formulario.imagen || null,
    };

    try {
      if (archivoImagen) {
        const subida = await productos.subirImagen(archivoImagen);
        datos.imagen = subida.imagen;
      }

      if (editando) {
        await productos.actualizar(editando.id_producto, datos);
        setMensaje(`Producto ${formulario.nombre} actualizado.`);
      } else {
        await productos.crear(datos);
        setMensaje(`Producto ${formulario.nombre} creado.`);
      }

      setModalAbierto(false);
      await cargarDatos();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo guardar el producto.");
    } finally {
      setGuardando(false);
    }
  };

  const alternarEstado = async (producto: Producto) => {
    const confirmado = window.confirm(
      producto.inhabilitado
        ? `¿Volver a habilitar ${producto.nombre}?`
        : `¿Inhabilitar ${producto.nombre}? Dejará de aparecer en el catálogo, pero no se borra.`
    );
    if (!confirmado) return;

    try {
      if (producto.inhabilitado) await productos.habilitar(producto.id_producto);
      else await productos.inhabilitar(producto.id_producto);

      setMensaje(
        producto.inhabilitado
          ? `${producto.nombre} quedó habilitado.`
          : `${producto.nombre} quedó inhabilitado.`
      );
      await cargarDatos();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo cambiar el estado.");
    }
  };

  const seleccionarImagen = (evento: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.currentTarget.files?.[0];
    evento.currentTarget.value = "";
    if (!archivo) return;

    const tiposPermitidos = ["image/jpeg", "image/png", "image/webp"];
    if (!tiposPermitidos.includes(archivo.type)) {
      setArchivoImagen(null);
      setVistaPrevia(editando ? urlImagenProducto(editando.imagen) : "");
      setError("Selecciona una imagen JPG, PNG o WebP.");
      return;
    }
    if (archivo.size > 5 * 1024 * 1024) {
      setArchivoImagen(null);
      setVistaPrevia(editando ? urlImagenProducto(editando.imagen) : "");
      setError("La imagen no puede superar 5 MB.");
      return;
    }

    setError("");
    setArchivoImagen(archivo);
    const lector = new FileReader();
    lector.onload = () => setVistaPrevia(String(lector.result ?? ""));
    lector.readAsDataURL(archivo);
  };

  const quitarImagen = () => {
    setArchivoImagen(null);
    setVistaPrevia("");
    setFormulario((previo) => ({ ...previo, imagen: "" }));
  };

  const cierraSiEsFondo = (evento: React.MouseEvent<HTMLDivElement>) => {
    if (evento.target === evento.currentTarget) setModalAbierto(false);
  };

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Administración"
        titulo="Productos"
        descripcion="Dotaciones que vende la empresa, con su precio en pesos y su talla."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "admin" } : undefined}
        accion={
          <button type="button" className="dt-accion-principal" onClick={abrirNuevo}>
            <Plus size={15} />
            Nuevo producto
          </button>
        }
      />

      {error && !modalAbierto && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}
      {mensaje && <Aviso tipo="exito" mensaje={mensaje} onCerrar={() => setMensaje("")} />}

      <FilaIndicadores>
        <Indicador etiqueta="Productos" valor={resumen.total} descripcion="En el catálogo" icono={Package} tono="azul" cargando={cargando} />
        <Indicador etiqueta="Disponibles" valor={resumen.activos} descripcion="Visibles para el cliente" icono={PackagePlus} tono="verde" cargando={cargando} />
        <Indicador etiqueta="Inhabilitados" valor={resumen.inactivos} descripcion="Fuera del catálogo" icono={PackageMinus} tono="rojo" cargando={cargando} />
        <Indicador etiqueta="Categorías" valor={resumen.categorias} descripcion="Tipos de dotación" icono={Tag} tono="morado" cargando={cargando} />
      </FilaIndicadores>

      <section className="dt-listado">
        <BarraListado
          titulo="Catálogo"
          descripcion={`${filtrados.length} de ${lista.length} productos`}
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

          <FiltroEstado
            valor={soloInactivos}
            onCambio={setSoloInactivos}
            opciones={[
              { valor: "", texto: "Todos" },
              { valor: "activos", texto: "Disponibles" },
              { valor: "inactivos", texto: "Inhabilitados" },
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
          <TablaCargando mensaje="Consultando el catálogo…" />
        ) : filtrados.length === 0 ? (
          <TablaVacia
            titulo="No hay productos"
            mensaje="Ajusta los filtros o crea el primer producto del catálogo."
            Icono={Package}
            accion={
              <button type="button" className="dt-accion-principal" onClick={abrirNuevo}>
                <Plus size={15} /> Nuevo producto
              </button>
            }
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
                  <th>Estado</th>
                  <th className="dt-columna-acciones">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filtrados.map((producto) => (
                  <tr key={producto.id_producto}>
                    <td>
                      <div className="dt-identidad-fila">
                        <span className="dt-avatar-fila">
                          {producto.imagen ? (
                            <img
                              className="dt-producto-miniatura"
                              src={urlImagenProducto(producto.imagen)}
                              alt={producto.nombre}
                            />
                          ) : (
                            <Shirt size={16} />
                          )}
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
                      <span className="dt-fila-principal">{pesos(producto.precio)}</span>
                    </td>

                    <td>
                      <EtiquetaActivo
                        activo={!producto.inhabilitado}
                        textoActivo="Disponible"
                        textoInactivo="Inhabilitado"
                      />
                    </td>

                    <td>
                      <div className="dt-acciones-fila">
                        <button
                          type="button"
                          className="dt-boton-icono"
                          title="Editar"
                          onClick={() => abrirEdicion(producto)}
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          type="button"
                          className="dt-boton-icono dt-boton-peligro"
                          title={producto.inhabilitado ? "Habilitar" : "Inhabilitar"}
                          onClick={() => void alternarEstado(producto)}
                        >
                          {producto.inhabilitado ? <PackagePlus size={14} /> : <PackageMinus size={14} />}
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

      {modalAbierto && (
        <div className="dt-modal-fondo" onMouseDown={cierraSiEsFondo}>
          <section className="dt-modal" role="dialog" aria-modal="true">
            <header className="dt-modal-encabezado">
              <span className="dt-modal-icono">
                <Shirt size={21} />
              </span>

              <div className="dt-modal-titulo-grupo">
                <span className="dt-migas">{editando ? "Editar" : "Nuevo producto"}</span>
                <h2>{editando ? editando.nombre : "Registrar dotación"}</h2>
                <p>El precio se escribe en pesos colombianos, sin puntos ni comas.</p>
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
                    Nombre <span>*</span>
                    <input
                      value={formulario.nombre}
                      onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })}
                      required
                    />
                  </label>

                  <label>
                    Categoría <span>*</span>
                    <input
                      list="categorias-producto"
                      value={formulario.categoria}
                      onChange={(e) => setFormulario({ ...formulario, categoria: e.target.value })}
                      required
                    />
                    <datalist id="categorias-producto">
                      {categorias.map((categoria) => (
                        <option key={categoria} value={categoria} />
                      ))}
                    </datalist>
                  </label>

                  <label>
                    Precio (COP) <span>*</span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={formulario.precio}
                      onChange={(e) => setFormulario({ ...formulario, precio: e.target.value })}
                      required
                    />
                  </label>

                  <label>
                    Talla
                    <input
                      value={formulario.talla}
                      onChange={(e) => setFormulario({ ...formulario, talla: e.target.value })}
                      placeholder="S, M, L, XL…"
                    />
                  </label>

                  <label>
                    Color
                    <input
                      value={formulario.color}
                      onChange={(e) => setFormulario({ ...formulario, color: e.target.value })}
                    />
                  </label>

                  <div className="dt-campo-ancho dt-imagen-producto-campo">
                    <span>Imagen del producto</span>
                    <input
                      className="dt-selector-imagen"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={seleccionarImagen}
                      disabled={guardando}
                      aria-label="Elegir imagen del producto"
                    />
                    <small>JPG, PNG o WebP · máximo 5 MB</small>
                    {vistaPrevia && (
                      <div className="dt-imagen-producto-previa">
                        <img src={vistaPrevia} alt="Vista previa del producto" />
                        <div>
                          <strong>{archivoImagen?.name ?? "Imagen actual"}</strong>
                          <button type="button" className="dt-boton-secundario" onClick={quitarImagen} disabled={guardando}>
                            Quitar imagen
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
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
                  {guardando ? <span className="dt-spinner" /> : <Package size={15} />}
                  {editando ? "Guardar cambios" : "Crear producto"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
