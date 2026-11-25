// src/pages/index.tsx
//
// index.html del proyecto Java: la portada pública.
// Muestra qué hace el sistema, cómo funciona, contacto y pie de página.

import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  CreditCard,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Store,
  Trash2,
} from "../components/iconos";
import { useSesion } from "../context/sesion-contexto";
import { FeedbackValidacion } from "../components/feedback-validacion";
import { useCamposTocados } from "../hooks/use-campos-tocados";
import { validarCorreo, validarTextoObligatorio } from "../utils/validaciones";
import {
  api,
  descuentos,
  ErrorApi,
  numero,
  pesos,
  productos,
  traerTodo,
  urlImagenProducto,
} from "../services/api";
import type { DescuentoVigente, Producto } from "../types";
import imagenError500 from "./error/error-500.png";

const ESTILO_BARRA: CSSProperties = {
  background: "rgba(10, 16, 28, 0.55)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.18)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  height: 64,
  padding: "0 28px",
  alignItems: "center",
};

const ESTILO_MARCA_CLARA: CSSProperties = {
  color: "#ffffff",
  textShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
};

const TEXTO_CLARO: CSSProperties = {
  color: "#ffffff",
  textShadow: "0 2px 8px rgba(0, 0, 0, 0.65), 0 1px 2px rgba(0, 0, 0, 0.4)",
};

/* Botones superiores: más pequeños y alineados */
const ESTILO_BOTON_FANTASMA: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  fontSize: 12.5,
  lineHeight: 1.2,
  borderRadius: 8,
  color: "#ffffff",
  borderColor: "rgba(255, 255, 255, 0.6)",
  background: "rgba(255, 255, 255, 0.14)",
  backdropFilter: "blur(4px)",
};

const ESTILO_BOTON_NARANJA: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  fontSize: 12.5,
  lineHeight: 1.2,
  borderRadius: 8,
  color: "#ffffff",
  background: "linear-gradient(135deg, #fa813b, #e06a28)",
  border: "1px solid transparent",
  boxShadow: "0 6px 16px rgba(250, 129, 59, 0.35)",
};

/* Rejilla común para las secciones de contenido */
const ESTILO_SECCION: CSSProperties = {
  width: "100%",
  maxWidth: 1120,
  margin: "0 auto",
  padding: "0 28px 20px",
  display: "grid",
  gap: 16,
  alignItems: "stretch",
};

const ESTILO_TARJETA_BLANCA: CSSProperties = {
  background: "#ffffff",
  borderRadius: 14,
  boxShadow: "0 14px 32px rgba(0, 0, 0, 0.22)",
};

/* ------------------------------------------------------------------
   Sección de contacto: panel oscuro con acentos naranja (combina con
   la portada). Todo inline para no depender del index.css.
------------------------------------------------------------------ */
const ESTILO_CONTACTO_SECCION: CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
  padding: "0 26px 96px",
  background: "transparent",
  border: "none",
  boxShadow: "none",
};

const ESTILO_CONTACTO_PANEL: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1.05fr",
  alignItems: "stretch",
  margin: 0,
  padding: 0,
  gap: 0,
  borderRadius: 26,
  overflow: "hidden",
  background: "linear-gradient(135deg, #1a1a2e 0%, #16213a 45%, #0f3460 100%)",
  boxShadow: "0 26px 60px rgba(0, 0, 0, 0.38)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
};

const ESTILO_CONTACTO_INFO: CSSProperties = {
  position: "relative",
  margin: 0,
  borderRadius: 0,
  padding: "36px 32px",
  color: "#ffffff",
  backgroundImage:
    "radial-gradient(560px 300px at 8% 0%, rgba(250, 129, 59, 0.28), transparent 62%)," +
    "radial-gradient(420px 300px at 100% 100%, rgba(255, 193, 69, 0.16), transparent 60%)",
};

const ESTILO_CONTACTO_TITULO: CSSProperties = {
  marginTop: 12,
  color: "#ffffff",
  fontFamily: '"Big Shoulders Display", "Inter", sans-serif',
  fontSize: 32,
  fontWeight: 800,
  letterSpacing: 0.4,
  lineHeight: 1,
  textTransform: "uppercase",
};

const ESTILO_CONTACTO_LEAD: CSSProperties = {
  margin: "10px 0 16px",
  color: "rgba(255, 255, 255, 0.82)",
  fontSize: 13,
  lineHeight: 1.6,
};

const ESTILO_CONTACTO_ITEM: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: "9px 0",
  borderTop: "1px solid rgba(255, 255, 255, 0.12)",
  color: "#ffffff",
  fontSize: 12.5,
  lineHeight: 1.5,
};

const ESTILO_CONTACTO_ICONO: CSSProperties = {
  flex: "none",
  display: "grid",
  placeItems: "center",
  width: 26,
  height: 26,
  borderRadius: 8,
  color: "#16213a",
  background: "#ffc145",
  fontSize: 13,
};

const ESTILO_FORM_CONTACTO: CSSProperties = {
  margin: 0,
  borderRadius: 0,
  boxShadow: "none",
  padding: "36px 32px",
  background: "#ffffff",
};

const BENEFICIOS = [
  {
    Icono: Store,
    titulo: "Catálogo de dotaciones",
    detalle: "Camisas, pantalones, calzado y seguridad con talla y color.",
  },
  {
    Icono: ShoppingCart,
    titulo: "Pedidos en línea",
    detalle: "El cliente arma su pedido y lo sigue hasta la entrega.",
  },
  {
    Icono: Boxes,
    titulo: "Inventario por bodega",
    detalle: "Entradas, salidas y alertas cuando baja del mínimo.",
  },
  {
    Icono: CreditCard,
    titulo: "Ventas y facturación",
    detalle: "Cada pedido entregado genera su venta y su factura.",
  },
];

const PASOS = [
  { numero: "1", titulo: "Regístrate", detalle: "Creas tu cuenta como cliente." },
  { numero: "2", titulo: "Pide", detalle: "Eliges dotaciones del catálogo." },
  { numero: "3", titulo: "Recibe", detalle: "Bodega despacha y tú confirmas." },
];

const FORMULARIO_CONTACTO_INICIAL = {
  nombre: "",
  correo: "",
  mensaje: "",
};

const CLAVE_CARRITO_PORTADA = "carrito_portada";

// La API de productos puede incluir disponibilidad y descripción en la portada.
type ProductoPortada = Producto & { descripcion?: string | null };

interface ItemCarritoPortada {
  producto: Producto;
  precioUnitario: number;
  precioLista: number;
  cantidad: number;
}

function calcularPrecioConDescuento(precio: string | number, descuento?: DescuentoVigente): number {
  return descuento ? numero(descuento.precio_unitario) : numero(precio);
}

export default function Portada() {
  const { usuario, cargando } = useSesion();
  const navegar = useNavigate();
  const [contacto, setContacto] = useState(FORMULARIO_CONTACTO_INICIAL);
  const [enviado, setEnviado] = useState(false);
  const [enviandoContacto, setEnviandoContacto] = useState(false);
  const [errorContacto, setErrorContacto] = useState("");
  const { tocar, tocarVarios, mostrar, reiniciar } = useCamposTocados();
  const erroresContacto = {
    nombre: validarTextoObligatorio(contacto.nombre, "El nombre", 2, 100),
    correo: validarCorreo(contacto.correo),
    mensaje: validarTextoObligatorio(contacto.mensaje, "El mensaje", 5, 3000),
  };

  const [catalogo, setCatalogo] = useState<ProductoPortada[]>([]);
  const [descuentosPorProducto, setDescuentosPorProducto] = useState<Record<number, DescuentoVigente>>({});
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);
  const [errorCatalogo, setErrorCatalogo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [paginaCatalogo, setPaginaCatalogo] = useState(0);
  // Dos filas: 4 columnas en escritorio y 2 columnas en pantallas pequeñas.
  const [productosPorPagina, setProductosPorPagina] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches ? 4 : 8
  );
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [avisoCarrito, setAvisoCarrito] = useState("");
  const [carritoLocal, setCarritoLocal] = useState<ItemCarritoPortada[]>(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_CARRITO_PORTADA);
      return guardado ? (JSON.parse(guardado) as ItemCarritoPortada[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_CARRITO_PORTADA, JSON.stringify(carritoLocal));
    } catch {
      // Ignorar errores de almacenamiento local.
    }
  }, [carritoLocal]);

  const cargarCatalogo = () => {
    setCargandoCatalogo(true);
    setErrorCatalogo("");

    return traerTodo((saltar, limite) =>
      productos.listar(
        { saltar, limite, incluir_inhabilitados: false },
        { redirigirEnError: false }
      )
    )
      .then(async (datos) => {
        const habilitados = datos.items.filter((p) => !p.inhabilitado);
        setCatalogo(habilitados);

        const pares = await Promise.all(
          habilitados.map(async (p) => {
            try {
              const desc = await descuentos.deProducto(p.id_producto, {
                redirigirEnError: false,
              });
              return desc ? ([p.id_producto, desc] as const) : null;
            } catch (fallo) {
              if (fallo instanceof ErrorApi && fallo.estado === 404) return null;
              throw fallo;
            }
          })
        );

        const mapa: Record<number, DescuentoVigente> = {};
        for (const par of pares) {
          if (par) mapa[par[0]] = par[1];
        }
        setDescuentosPorProducto(mapa);
      })
      .catch((fallo) => {
        setCatalogo([]);
        setErrorCatalogo(
          fallo instanceof Error
            ? fallo.message
            : "No se pudieron cargar los productos. Verifica que el servidor backend esté encendido."
        );
      })
      .finally(() => {
        setCargandoCatalogo(false);
      });
  };

  useEffect(() => {
    void cargarCatalogo();
  }, []);

  useEffect(() => {
    const pantallaPequena = window.matchMedia("(max-width: 900px)");
    const ajustarPagina = () => {
      setProductosPorPagina(pantallaPequena.matches ? 4 : 8);
      setPaginaCatalogo(0);
    };
    pantallaPequena.addEventListener("change", ajustarPagina);
    return () => pantallaPequena.removeEventListener("change", ajustarPagina);
  }, []);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return catalogo;
    return catalogo.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.descripcion ?? "").toLowerCase().includes(q) ||
        (p.talla ?? "").toLowerCase().includes(q) ||
        (p.color ?? "").toLowerCase().includes(q)
    );
  }, [catalogo, busqueda]);

  const totalPaginasCatalogo = Math.max(
    1,
    Math.ceil(productosFiltrados.length / productosPorPagina)
  );
  const paginaVisibleCatalogo = Math.min(paginaCatalogo, totalPaginasCatalogo - 1);
  const productosPagina = useMemo(() => {
    const inicio = paginaVisibleCatalogo * productosPorPagina;
    return productosFiltrados.slice(inicio, inicio + productosPorPagina);
  }, [productosFiltrados, paginaVisibleCatalogo, productosPorPagina]);

  const totalUnidadesCarrito = useMemo(
    () => carritoLocal.reduce((acc, item) => acc + item.cantidad, 0),
    [carritoLocal]
  );

  const totalCarrito = useMemo(
    () => carritoLocal.reduce((acc, item) => acc + item.precioUnitario * item.cantidad, 0),
    [carritoLocal]
  );

  const agregarAlCarrito = (producto: Producto) => {
    const cantidad = Math.max(1, cantidades[producto.id_producto] ?? 1);
    const precioLista = numero(producto.precio);
    const precioUnitario = calcularPrecioConDescuento(
      producto.precio,
      descuentosPorProducto[producto.id_producto]
    );

    setCarritoLocal((previo) => {
      const existente = previo.find((i) => i.producto.id_producto === producto.id_producto);
      if (existente) {
        return previo.map((i) =>
          i.producto.id_producto === producto.id_producto
            ? { ...i, cantidad: i.cantidad + cantidad, precioUnitario, precioLista }
            : i
        );
      }
      return [...previo, { producto, precioUnitario, precioLista, cantidad }];
    });

    setAvisoCarrito(`"${producto.nombre}" agregado al carrito (${pesos(precioUnitario)}).`);
  };

  const cambiarCantidadCarrito = (idProducto: number, nuevaCantidad: number) => {
    if (nuevaCantidad < 1) return;
    setCarritoLocal((previo) =>
      previo.map((i) =>
        i.producto.id_producto === idProducto ? { ...i, cantidad: nuevaCantidad } : i
      )
    );
  };

  const quitarDelCarrito = (idProducto: number) => {
    setCarritoLocal((previo) => previo.filter((i) => i.producto.id_producto !== idProducto));
  };

  const irAComprar = () => {
    navegar("/login");
  };

  const verCarrito = () => {
    document.getElementById("carrito-portada")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  function cambiarContacto(evento: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = evento.target;
    setContacto((anterior) => ({ ...anterior, [name]: value }));
    tocar(name);
  }

  async function enviarContacto(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviandoContacto) return;

    const datos = {
      nombre: contacto.nombre.trim(),
      correo: contacto.correo.trim(),
      mensaje: contacto.mensaje.trim(),
    };
    const validacion = Object.values(erroresContacto).find(Boolean);
    if (validacion) {
      tocarVarios(Object.keys(erroresContacto));
      setErrorContacto(validacion);
      return;
    }

    setErrorContacto("");
    setEnviandoContacto(true);
    try {
      await api.post<{ mensaje: string }>("/contacto", datos, { redirigirEnError: false });
      setContacto(FORMULARIO_CONTACTO_INICIAL);
      reiniciar();
      setEnviado(true);
    } catch (fallo) {
      setErrorContacto(fallo instanceof Error ? fallo.message : "No se pudo enviar el mensaje. Inténtalo de nuevo.");
    } finally {
      setEnviandoContacto(false);
    }
  }

  if (cargando) {
    return (
      <div className="dt-pantalla-carga">
        <span className="dt-spinner dt-spinner-grande" />
        <span>Cargando…</span>
      </div>
    );
  }

  if (usuario) {
    return (
      <Navigate
        to={
          { 1: "/admin/panel", 2: "/cliente/panel", 3: "/vendedor/panel", 4: "/bodeguero/panel" }[
            usuario.id_rol
          ] ?? "/login"
        }
        replace
      />
    );
  }

  return (
    <div className={`portada ${carritoLocal.length > 0 ? "portada-con-carrito" : ""}`}>
      <header className="portada-barra" style={ESTILO_BARRA}>
        <div className="marca marca-oscura" style={ESTILO_MARCA_CLARA}>
          <span className="marca-icono-solido">
            <Package size={18} />
          </span>
          Dotaciones <span className="marca-verde">Toronto</span>
        </div>

        <nav className="portada-barra-acciones" style={{ alignItems: "center", gap: 8 }}>
          <Link to="/login" className="dt-boton-secundario" style={ESTILO_BOTON_FANTASMA}>
            Iniciar sesión
          </Link>
          <Link to="/registro" className="dt-accion-principal" style={ESTILO_BOTON_NARANJA}>
            Crear cuenta <ArrowRight size={13} />
          </Link>
        </nav>
      </header>

      {/* ---------------------------------------------------------- Héroe */}
      <section className="portada-heroe" style={{ maxWidth: 1120, padding: "54px 28px 44px" }}>
        <span
          className="etiqueta"
          style={{
            color: "#ffffff",
            borderColor: "rgba(255, 255, 255, 0.5)",
            background: "rgba(10, 16, 28, 0.55)",
            fontSize: 10,
            letterSpacing: 1.2,
          }}
        >
          DOTACIONES EMPRESARIALES
        </span>

        <h1 style={{ ...TEXTO_CLARO, fontSize: "clamp(30px, 3.6vw, 52px)", maxWidth: "20ch" }}>
          Toda la dotación de tu empresa,
          <br />
          pedida y controlada en un solo lugar.
        </h1>

        <p style={{ ...TEXTO_CLARO, fontWeight: 500, fontSize: 14.5, maxWidth: "56ch" }}>
          Catálogo, pedidos, inventario, ventas y facturación electrónica.
          Cada rol ve únicamente lo que necesita.
        </p>

        <div className="portada-heroe-acciones" style={{ marginTop: 22, gap: 10 }}>
          <Link to="/registro" className="dt-accion-principal" style={{ padding: "10px 18px", fontSize: 13 }}>
            Empezar ahora <ArrowRight size={14} />
          </Link>
          <Link to="/login" className="dt-boton-secundario" style={ESTILO_BOTON_FANTASMA}>
            Ya tengo cuenta
          </Link>
        </div>

        <ul className="portada-lista" style={{ marginTop: 22, gap: 8 }}>
          <li style={{ ...TEXTO_CLARO, fontSize: 12.5 }}>
            <Check size={14} style={{ color: "#ffc145" }} /> Control de stock con alertas
          </li>
          <li style={{ ...TEXTO_CLARO, fontSize: 12.5 }}>
            <Check size={14} style={{ color: "#ffc145" }} /> Pedidos y devoluciones trazables
          </li>
          <li style={{ ...TEXTO_CLARO, fontSize: 12.5 }}>
            <Check size={14} style={{ color: "#ffc145" }} /> Facturación DIAN simulada, lista para conectar
          </li>
        </ul>
      </section>

      {/* ------------------------------------------------------- Beneficios */}
      <section
        id="quehacemos"
        className="portada-beneficios"
        style={{ ...ESTILO_SECCION, gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}
      >
        {BENEFICIOS.map((beneficio) => (
          <article
            key={beneficio.titulo}
            className="portada-beneficio"
            style={{ ...ESTILO_TARJETA_BLANCA, padding: 18 }}
          >
            <span className="dt-acceso-icono">
              <beneficio.Icono size={17} />
            </span>
            <strong style={{ fontSize: 14 }}>{beneficio.titulo}</strong>
            <span style={{ fontSize: 12 }}>{beneficio.detalle}</span>
          </article>
        ))}
      </section>

      {/* --------------------------------------------------------- Catálogo */}
      <section
        id="catalogo"
        style={{ ...ESTILO_SECCION, gridTemplateColumns: "1fr" }}
      >
        <div className="portada-catalogo-panel" style={{ ...ESTILO_TARJETA_BLANCA, padding: 22 }}>
          <div className="portada-catalogo-encabezado">
            <div className="portada-catalogo-titulos">
              <h2 className="portada-catalogo-titulo">Catálogo de dotaciones</h2>
              <p className="portada-catalogo-descripcion">
                Selecciona los productos que necesitas y agrégalos al carrito. Para finalizar la compra debes iniciar sesión.
              </p>
            </div>

            <div className="portada-catalogo-controles">
              <div className="portada-catalogo-busqueda">
                <Search size={15} style={{ color: "#64748b" }} />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setPaginaCatalogo(0);
                  }}
                  placeholder="Buscar producto, talla o color..."
                  style={{ border: "none", outline: "none", fontSize: 13, minWidth: 200 }}
                />
              </div>

              <button
                type="button"
                className="dt-accion-principal portada-catalogo-boton-carrito"
                onClick={verCarrito}
                disabled={carritoLocal.length === 0}
                aria-label={`Ver carrito con ${totalUnidadesCarrito} productos, total ${pesos(totalCarrito)}`}
              >
                <ShoppingCart size={15} />
                Ver carrito ({totalUnidadesCarrito}) · {pesos(totalCarrito)}
              </button>
            </div>
          </div>

          {avisoCarrito && (
            <div className="portada-aviso-carrito" role="status" aria-live="polite">
              <span>{avisoCarrito}</span>
              <div className="portada-aviso-carrito-acciones">
                <button type="button" onClick={verCarrito}>
                  Ver carrito
                </button>
                <button type="button" onClick={() => setAvisoCarrito("")}>
                  Cerrar
                </button>
              </div>
            </div>
          )}

          {cargandoCatalogo ? (
            <div style={{ padding: "28px 0", textAlign: "center", color: "#64748b", fontSize: 14 }}>
              <span className="dt-spinner" /> Cargando productos del catálogo…
            </div>
          ) : errorCatalogo ? (
            <div className="error-bloque-imagen" role="alert">
              <img
                src={imagenError500}
                alt="Error al cargar el catálogo del servidor"
              />
              <p>{errorCatalogo}</p>
              <button
                type="button"
                className="dt-boton-secundario"
                onClick={() => void cargarCatalogo()}
              >
                Reintentar
              </button>
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div style={{ padding: "28px 0", textAlign: "center", color: "#64748b", fontSize: 14 }}>
              No hay productos disponibles en este momento.
            </div>
          ) : (
            <div className="portada-carrusel">
              <div className="portada-carrusel-escenario">
                {totalPaginasCatalogo > 1 && (
                  <button
                    type="button"
                    className="portada-carrusel-flecha portada-carrusel-anterior"
                    onClick={() => setPaginaCatalogo(Math.max(0, paginaVisibleCatalogo - 1))}
                    disabled={paginaVisibleCatalogo === 0}
                    aria-label="Ver productos anteriores"
                    title="Productos anteriores"
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
                <div className="portada-carrusel-grid" aria-live="polite">
                  {productosPagina.map((producto) => {
                    const desc = descuentosPorProducto[producto.id_producto];
                    const precioLista = numero(producto.precio);
                    const precioFinal = calcularPrecioConDescuento(producto.precio, desc);
                    const tieneDescuento = precioFinal < precioLista;
                    const cantidad = cantidades[producto.id_producto] ?? 1;
                    const imagen = urlImagenProducto(producto.imagen);
                    const tieneStockDefinido = typeof producto.stock === "number";
                    const sinStock =
                      producto.estado?.toLowerCase() === "agotado" ||
                      (tieneStockDefinido && (producto.stock ?? 0) <= 0);

                    return (
                      <article
                        key={producto.id_producto}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 12,
                          padding: 14,
                          background: "#ffffff",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            position: "relative",
                            height: 150,
                            borderRadius: 8,
                            background: "#f8fafc",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                          }}
                        >
                          {imagen ? (
                            <img
                              src={imagen}
                              alt={producto.nombre}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <Package size={36} style={{ color: "#94a3b8" }} />
                          )}
                          {tieneDescuento && desc && (
                            <span
                              style={{
                                position: "absolute",
                                top: 8,
                                right: 8,
                                maxWidth: "calc(100% - 16px)",
                                padding: "5px 8px",
                                borderRadius: 6,
                                color: "#ffffff",
                                background: "#c2410c",
                                fontSize: 11,
                                fontWeight: 700,
                                lineHeight: 1.2,
                                textAlign: "right",
                              }}
                            >
                              {desc.descuento.tipo_descuento === "PORCENTAJE"
                                ? `${numero(desc.descuento.valor_descuento)}% de descuento`
                                : `${pesos(desc.descuento.valor_descuento)} de descuento`}
                            </span>
                          )}
                        </div>

                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: 14.5, display: "block" }}>{producto.nombre}</strong>
                          {(producto.talla || producto.color) && (
                            <span style={{ fontSize: 12, color: "#64748b", display: "block", marginTop: 2 }}>
                              {producto.talla ?? "Única"} · {producto.color ?? "Estándar"}
                            </span>
                          )}
                          {producto.descripcion && (
                            <p style={{ fontSize: 12, color: "#475569", margin: "6px 0 0" }}>
                              {producto.descripcion}
                            </p>
                          )}
                        </div>

                        <div>
                          {tieneDescuento && desc && (
                            <div style={{ marginBottom: 5, color: "#15803d", fontSize: 12, fontWeight: 700 }}>
                              Promoción: {desc.descuento.tipo_descuento === "PORCENTAJE"
                                ? `${numero(desc.descuento.valor_descuento)}% de descuento`
                                : `${pesos(desc.descuento.valor_descuento)} de descuento`}
                              {desc.descuento.fecha_fin && ` · Hasta ${desc.descuento.fecha_fin}`}
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                            <strong style={{ fontSize: 16, color: "#0f172a" }}>
                              {pesos(precioFinal)}
                            </strong>
                            {tieneDescuento && (
                              <s style={{ fontSize: 12, color: "#94a3b8" }}>{pesos(precioLista)}</s>
                            )}
                          </div>
                          <span style={{ fontSize: 11.5, color: sinStock ? "#dc2626" : "#64748b" }}>
                            {sinStock
                              ? "Agotado"
                              : tieneStockDefinido
                                ? `Disponible: ${producto.stock}`
                                : "Disponible"}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <button
                              type="button"
                              className="dt-boton-icono"
                              disabled={sinStock || cantidad <= 1}
                              onClick={() =>
                                setCantidades((prev) => ({
                                  ...prev,
                                  [producto.id_producto]: Math.max(1, (prev[producto.id_producto] ?? 1) - 1),
                                }))
                              }
                              aria-label="Disminuir cantidad"
                            >
                              <Minus size={13} />
                            </button>
                            <span style={{ minWidth: 22, textAlign: "center", fontSize: 13, fontWeight: 600 }}>
                              {cantidad}
                            </span>
                            <button
                              type="button"
                              className="dt-boton-icono"
                              disabled={sinStock || (tieneStockDefinido && cantidad >= (producto.stock ?? 0))}
                              onClick={() =>
                                setCantidades((prev) => {
                                  const siguiente = (prev[producto.id_producto] ?? 1) + 1;
                                  return {
                                    ...prev,
                                    [producto.id_producto]: tieneStockDefinido
                                      ? Math.min(producto.stock ?? siguiente, siguiente)
                                      : siguiente,
                                  };
                                })
                              }
                              aria-label="Aumentar cantidad"
                            >
                              <Plus size={13} />
                            </button>
                          </div>

                          <button
                            type="button"
                            className="dt-accion-principal"
                            disabled={sinStock}
                            onClick={() => agregarAlCarrito(producto)}
                            style={{ flex: 1, justifyContent: "center", fontSize: 12.5, padding: "8px 10px" }}
                          >
                            <ShoppingCart size={14} />
                            Agregar
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {totalPaginasCatalogo > 1 && (
                  <button
                    type="button"
                    className="portada-carrusel-flecha portada-carrusel-siguiente"
                    onClick={() =>
                      setPaginaCatalogo(
                        Math.min(paginaVisibleCatalogo + 1, totalPaginasCatalogo - 1)
                      )
                    }
                    disabled={paginaVisibleCatalogo >= totalPaginasCatalogo - 1}
                    aria-label="Ver productos siguientes"
                    title="Productos siguientes"
                  >
                    <ArrowRight size={20} />
                  </button>
                )}
              </div>
              {totalPaginasCatalogo > 1 && (
                <nav className="portada-carrusel-puntos" aria-label="Páginas del catálogo">
                  {Array.from({ length: totalPaginasCatalogo }, (_, pagina) => (
                    <button
                      key={pagina}
                      type="button"
                      className={`portada-carrusel-punto ${
                        paginaVisibleCatalogo === pagina ? "activo" : ""
                      }`}
                      onClick={() => setPaginaCatalogo(pagina)}
                      aria-label={`Ver página ${pagina + 1} de ${totalPaginasCatalogo}`}
                      aria-current={paginaVisibleCatalogo === pagina ? "page" : undefined}
                    />
                  ))}
                </nav>
              )}
            </div>
          )}

          {carritoLocal.length > 0 && (
            <div
              id="carrito-portada"
              className="portada-carrito-detalle"
              tabIndex={-1}
              aria-label="Productos seleccionados en el carrito"
            >
              <div className="portada-carrito-detalle-encabezado">
                <strong style={{ fontSize: 15 }}>
                  Tu carrito ({totalUnidadesCarrito} {totalUnidadesCarrito === 1 ? "unidad" : "unidades"})
                </strong>
                <button
                  type="button"
                  className="dt-boton-secundario"
                  onClick={() => setCarritoLocal([])}
                  style={{ fontSize: 12, padding: "4px 10px" }}
                >
                  Vaciar carrito
                </button>
              </div>

              <div className="portada-carrito-items">
                {carritoLocal.map((item) => (
                  <div key={item.producto.id_producto} className="portada-carrito-item">
                    <div>
                      <strong>{item.producto.nombre}</strong>
                      <span style={{ color: "#64748b", marginLeft: 8 }}>
                        {pesos(item.precioUnitario)} c/u
                      </span>
                    </div>

                    <div className="portada-carrito-item-acciones">
                      <button
                        type="button"
                        className="dt-boton-icono"
                        disabled={item.cantidad <= 1}
                        onClick={() => cambiarCantidadCarrito(item.producto.id_producto, item.cantidad - 1)}
                        aria-label="Quitar uno"
                      >
                        <Minus size={12} />
                      </button>
                      <span style={{ minWidth: 20, textAlign: "center", fontWeight: 600 }}>
                        {item.cantidad}
                      </span>
                      <button
                        type="button"
                        className="dt-boton-icono"
                        onClick={() => cambiarCantidadCarrito(item.producto.id_producto, item.cantidad + 1)}
                        aria-label="Agregar uno"
                      >
                        <Plus size={12} />
                      </button>

                      <strong style={{ minWidth: 84, textAlign: "right" }}>
                        {pesos(item.precioUnitario * item.cantidad)}
                      </strong>

                      <button
                        type="button"
                        className="dt-boton-icono dt-boton-peligro"
                        onClick={() => quitarDelCarrito(item.producto.id_producto)}
                        aria-label="Quitar producto"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 15 }}>
                  Total a pagar: <strong>{pesos(totalCarrito)}</strong>
                </span>
                <button
                  type="button"
                  className="dt-accion-principal"
                  onClick={irAComprar}
                  style={{ padding: "10px 18px", fontSize: 13.5 }}
                >
                  Iniciar sesión para comprar <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ Pasos */}
      <section
        id="como-funciona"
        className="portada-pasos"
        style={{ ...ESTILO_SECCION, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
      >
        {PASOS.map((paso) => (
          <article
            key={paso.numero}
            className="portada-paso"
            style={{ ...ESTILO_TARJETA_BLANCA, padding: 16 }}
          >
            <span className="portada-paso-numero">{paso.numero}</span>
            <strong style={{ fontSize: 13 }}>{paso.titulo}</strong>
            <span style={{ fontSize: 12 }}>{paso.detalle}</span>
          </article>
        ))}
      </section>

      {/* --------------------------------------------------------- Contacto */}
      <section id="contacto" className="portada-contacto" style={ESTILO_CONTACTO_SECCION}>
        <div className="portada-contacto-grid" style={ESTILO_CONTACTO_PANEL}>
          <div className="portada-contacto-info" style={ESTILO_CONTACTO_INFO}>
            <span
              className="etiqueta"
              style={{
                color: "#16213a",
                background: "#ffc145",
                borderColor: "#ffc145",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 1.2,
              }}
            >
              CONTACTO
            </span>

            <h2 style={ESTILO_CONTACTO_TITULO}>Contáctanos</h2>
            <p style={ESTILO_CONTACTO_LEAD}>
              ¿Tienes una duda o un reclamo? Escríbenos y te respondemos el mismo día hábil.
            </p>

            <div style={{ marginTop: 6 }}>
              <div style={ESTILO_CONTACTO_ITEM}>
                <span style={ESTILO_CONTACTO_ICONO}>
                  <i className="bi bi-telephone" aria-hidden="true" />
                </span>
                <span>+57 321 209 9989</span>
              </div>
              <div style={ESTILO_CONTACTO_ITEM}>
                <span style={ESTILO_CONTACTO_ICONO}>
                  <i className="bi bi-envelope" aria-hidden="true" />
                </span>
                <span>dotacionestoronto1@gmail.com</span>
              </div>
              <div style={ESTILO_CONTACTO_ITEM}>
                <span style={ESTILO_CONTACTO_ICONO}>
                  <i className="bi bi-geo-alt" aria-hidden="true" />
                </span>
                <span>Carrera 63 Sur #21-12, Bogotá D.C., Colombia</span>
              </div>
              <div style={ESTILO_CONTACTO_ITEM}>
                <span style={ESTILO_CONTACTO_ICONO}>
                  <i className="bi bi-clock" aria-hidden="true" />
                </span>
                <div>
                  <div>Lunes a viernes: 8am – 6pm</div>
                  <div>Sábado: 9am – 2pm</div>
                  <div>Domingo: cerrado</div>
                </div>
              </div>
            </div>
          </div>

          <div className="portada-tablero" style={ESTILO_FORM_CONTACTO}>
            {enviado ? (
              <div className="portada-tablero-ok">
                <Check size={26} />
                <h3>¡Mensaje enviado!</h3>
                <p>Gracias por escribirnos. Te responderemos el mismo día hábil.</p>
                <button
                  type="button"
                  className="dt-boton-secundario"
                  onClick={() => setEnviado(false)}
                >
                  Enviar otro mensaje
                </button>
              </div>
            ) : (
              <form className="portada-tablero-form" noValidate onSubmit={enviarContacto}>
                <label>
                  Nombre
                  <input
                    type="text"
                    name="nombre"
                    placeholder="¿Cómo te llamas?"
                    value={contacto.nombre}
                    onChange={cambiarContacto}
                    minLength={2}
                    maxLength={100}
                    disabled={enviandoContacto}
                    onBlur={() => tocar("nombre")}
                    aria-invalid={mostrar("nombre") && Boolean(erroresContacto.nombre)}
                    aria-describedby="contacto-nombre-feedback"
                    required
                  />
                  <FeedbackValidacion id="contacto-nombre-feedback" error={erroresContacto.nombre} mostrar={mostrar("nombre")} />
                </label>

                <label>
                  Correo electrónico
                  <input
                    type="email"
                    name="correo"
                    placeholder="tucorreo@ejemplo.com"
                    value={contacto.correo}
                    onChange={cambiarContacto}
                    maxLength={254}
                    disabled={enviandoContacto}
                    onBlur={() => tocar("correo")}
                    aria-invalid={mostrar("correo") && Boolean(erroresContacto.correo)}
                    aria-describedby="contacto-correo-feedback"
                    required
                  />
                  <FeedbackValidacion id="contacto-correo-feedback" error={erroresContacto.correo} mostrar={mostrar("correo")} />
                </label>

                <label>
                  Mensaje
                  <textarea
                    name="mensaje"
                    placeholder="Cuéntanos qué necesitas"
                    value={contacto.mensaje}
                    onChange={cambiarContacto}
                    maxLength={3000}
                    disabled={enviandoContacto}
                    onBlur={() => tocar("mensaje")}
                    aria-invalid={mostrar("mensaje") && Boolean(erroresContacto.mensaje)}
                    aria-describedby="contacto-mensaje-feedback"
                    required
                  />
                  <FeedbackValidacion id="contacto-mensaje-feedback" error={erroresContacto.mensaje} mostrar={mostrar("mensaje")} valido="Mensaje válido." />
                </label>

                {errorContacto && (
                  <p role="alert" style={{ color: "#b91c1c", fontSize: 13, margin: 0 }}>
                    {errorContacto}
                  </p>
                )}
                <button type="submit" className="dt-accion-principal portada-tablero-enviar" disabled={enviandoContacto}>
                  {enviandoContacto ? "Enviando…" : "Enviar mensaje"} <ArrowRight size={14} />
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- Pie */}
      <footer className="portada-footer">
        <div className="portada-footer-grid">
          <div>
            <div className="marca" style={ESTILO_MARCA_CLARA}>
              <span className="marca-icono-solido">
                <Package size={18} />
              </span>
              Dotaciones <span className="marca-verde">Toronto</span>
            </div>
            <p>
              Distribución de dotaciones y equipos de protección personal para la industria,
              en Bogotá desde hace 13 años.
            </p>
          </div>

          <div>
            <h5>Navegación</h5>
            <ul>
              <li>
                <a href="#quehacemos">Qué hacemos</a>
              </li>
              <li>
                <a href="#como-funciona">Cómo funciona</a>
              </li>
              <li>
                <a href="#contacto">Contacto</a>
              </li>
              <li>
                <Link to="/login">Iniciar sesión</Link>
              </li>
              <li>
                <Link to="/registro">Registrarse</Link>
              </li>
            </ul>
          </div>

          <div>
            <h5>Horario de atención</h5>
            <ul className="portada-footer-estatico">
              <li>Lunes a viernes: 8am – 6pm</li>
              <li>Sábado: 9am – 2pm</li>
              <li>Domingo: cerrado</li>
            </ul>
          </div>
        </div>

        <div className="portada-footer-linea">
          <div className="portada-footer-base">
            <span>© 2026 Dotaciones Toronto. Todos los derechos reservados.</span>
            <span>Bogotá D.C., Colombia</span>
          </div>
        </div>
      </footer>

      {carritoLocal.length > 0 && (
        <aside className="portada-carrito-flotante" aria-live="polite" aria-label="Resumen del carrito">
          <div className="portada-carrito-flotante-resumen">
            <span className="portada-carrito-flotante-icono">
              <ShoppingCart size={17} />
            </span>
            <span>
              <strong>Tu carrito</strong>
              <small>{totalUnidadesCarrito} {totalUnidadesCarrito === 1 ? "producto" : "productos"} seleccionados</small>
            </span>
          </div>
          <strong className="portada-carrito-flotante-total">{pesos(totalCarrito)}</strong>
          <button type="button" onClick={verCarrito}>
            Ver carrito <ArrowRight size={15} />
          </button>
        </aside>
      )}
    </div>
  );
}