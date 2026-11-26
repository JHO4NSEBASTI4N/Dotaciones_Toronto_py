// src/services/api.ts
//
// Cliente HTTP contra el backend real (66 rutas, commit b14e1a8).
// Todo endpoint de lista devuelve { total, saltar, limite, items }.
//
// Configuracion de la URL del API:
//   - Por defecto: http://localhost:8000/api/v1
//   - Para cambiarla, crea `frontend/.env` con:  VITE_API_URL=http://mi-servidor:8000/api/v1

import type {
  AlertaStock,
  Carrito,
  Descuento,
  DescuentoVigente,
  Devolucion,
  DevolucionCrear,
  EventoFactura,
  FacturaElectronica,
  FiltrosPedido,
  FiltrosProducto,
  FiltrosUsuario,
  FiltrosVenta,
  Inventario,
  LineaFactura,
  MisRoles,
  MovimientoInventario,
  Pagina,
  Pedido,
  Producto,
  ProductoCrear,
  Resolucion,
  Rol,
  RolCrear,
  RolesDeUsuario,
  ReporteVendedor,
  StockPorProducto,
  TokenSalida,
  Usuario,
  UsuarioActualizar,
  UsuarioCrear,
  UsuarioDetalle,
  Venta,
  IngresoPorMes,
} from "../types";

export const BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

/** Convierte una ruta almacenada en la BD en una URL cargable desde el navegador. */
export function urlImagenProducto(ruta: string | null | undefined): string {
  if (!ruta) return "";
  if (/^(https?:|data:|blob:)/i.test(ruta)) return ruta;
  if (typeof window === "undefined") return ruta;
  const origenApi = new URL(BASE_URL, window.location.href).origin;
  return new URL(ruta, origenApi).toString();
}

type Metodo = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Construye ?a=1&b=2 saltandose los valores vacios. */
export function aQuery(parametros: object): string {
  const partes = Object.entries(parametros as Record<string, unknown>)
    .filter(([, valor]) => valor !== undefined && valor !== null && valor !== "")
    .map(([clave, valor]) => `${clave}=${encodeURIComponent(String(valor))}`);
  return partes.length ? `?${partes.join("&")}` : "";
}

export class ErrorApi extends Error {
  estado: number;
  constructor(mensaje: string, estado: number) {
    super(mensaje);
    this.name = "ErrorApi";
    this.estado = estado;
  }
}

export type CodigoPaginaError = "403" | "404" | "500" | "general";

export interface EventoPaginaError {
  codigo: CodigoPaginaError;
  origen: string;
  mensaje?: string;
}

export interface OpcionesPeticion {
  /** Si es false, no redirige automáticamente a /error/* ante fallos HTTP o de red. */
  redirigirEnError?: boolean;
}

export const EVENTO_ERROR_HTTP = "dt:pagina-error";

/** Dispara la navegación hacia la pantalla de error con su imagen correspondiente. */
export function notificarPaginaError(
  codigo: CodigoPaginaError,
  mensaje?: string
): void {
  if (typeof window === "undefined") return;
  const rutaActual = window.location.pathname;
  if (rutaActual.startsWith("/error/")) return;

  window.dispatchEvent(
    new CustomEvent<EventoPaginaError>(EVENTO_ERROR_HTTP, {
      detail: {
        codigo,
        origen: `${rutaActual}${window.location.search}`,
        mensaje,
      },
    })
  );
}

function esReglaNegocioEn403(endpoint: string): boolean {
  // En /auth/login un 403 informa cuenta inhabilitada o sin rol asignado;
  // en /pedidos/{id}/cancelar indica que el pedido ya no está en Pendiente.
  return (
    endpoint.startsWith("/auth/login") || /^\/pedidos\/\d+\/cancelar$/.test(endpoint)
  );
}

// ---------- Cliente base ----------

async function peticion<T>(
  endpoint: string,
  metodo: Metodo = "GET",
  cuerpo?: unknown,
  opciones: OpcionesPeticion = {}
): Promise<T> {
  const redirigir = opciones.redirigirEnError !== false;
  const token = localStorage.getItem("token");

  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE_URL}${endpoint}`, {
      method: metodo,
      headers: {
        ...(cuerpo instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body:
        cuerpo === undefined
          ? undefined
          : cuerpo instanceof FormData
            ? cuerpo
            : JSON.stringify(cuerpo),
    });
  } catch (fallo) {
    if (fallo instanceof DOMException && fallo.name === "AbortError") {
      throw fallo;
    }
    const mensajeRed =
      "No se pudo contactar el servidor. Revisa que el backend esté encendido.";
    if (redirigir) {
      notificarPaginaError("500", mensajeRed);
    }
    throw new ErrorApi(mensajeRed, 0);
  }

  if (!respuesta.ok) {
    // 401 = token vencido o invalido: se cierra la sesion.
    if (respuesta.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      localStorage.removeItem("rol_activo");
    }

    // El backend responde { error, detalle } en los errores de negocio.
    let mensaje = `Error ${respuesta.status}`;
    try {
      const datos = await respuesta.json();
      if (typeof datos?.detalle === "string") mensaje = datos.detalle;
      else if (typeof datos?.detail === "string") mensaje = datos.detail;
      else if (Array.isArray(datos?.detail)) {
        // Errores de validacion de FastAPI/Pydantic.
        mensaje = datos.detail
          .map((d: { msg?: string; loc?: string[] }) => d.msg ?? "")
          .filter(Boolean)
          .join(". ");
      }
    } catch {
      /* la respuesta no traia JSON */
    }

    if (redirigir) {
      if (respuesta.status >= 500) {
        notificarPaginaError("500", mensaje);
      } else if (respuesta.status === 403 && !esReglaNegocioEn403(endpoint)) {
        if (mensaje.toLowerCase().includes("inhabilitado")) {
          localStorage.removeItem("token");
          localStorage.removeItem("usuario");
          localStorage.removeItem("rol_activo");
        }
        notificarPaginaError("403", mensaje);
      }
    }

    throw new ErrorApi(mensaje, respuesta.status);
  }

  if (respuesta.status === 204) return undefined as T;
  return respuesta.json() as Promise<T>;
}

export const api = {
  get: <T>(endpoint: string, opciones?: OpcionesPeticion) =>
    peticion<T>(endpoint, "GET", undefined, opciones),
  post: <T>(endpoint: string, cuerpo?: unknown, opciones?: OpcionesPeticion) =>
    peticion<T>(endpoint, "POST", cuerpo, opciones),
  put: <T>(endpoint: string, cuerpo?: unknown, opciones?: OpcionesPeticion) =>
    peticion<T>(endpoint, "PUT", cuerpo, opciones),
  patch: <T>(endpoint: string, cuerpo?: unknown, opciones?: OpcionesPeticion) =>
    peticion<T>(endpoint, "PATCH", cuerpo, opciones),
  del: <T>(endpoint: string, opciones?: OpcionesPeticion) =>
    peticion<T>(endpoint, "DELETE", undefined, opciones),
};

// ---------------------------------------------------------------------------
// Autenticacion
// ---------------------------------------------------------------------------

export const auth = {
  login: (correo: string, password: string, id_rol?: number) =>
    api.post<TokenSalida>("/auth/login", { correo, password, id_rol }),
  registro: (datos: UsuarioCrear) => api.post<Usuario>("/auth/registro", datos),
  yo: (opciones?: OpcionesPeticion) =>
    api.get<UsuarioDetalle>("/auth/yo", opciones),
  misRoles: (opciones?: OpcionesPeticion) =>
    api.get<MisRoles>("/auth/mis-roles", opciones),
  cambiarRol: (id_rol: number) =>
    api.post<TokenSalida>("/auth/cambiar-rol", { id_rol }),
  activarCliente: () => api.post<MisRoles>("/auth/activar-cliente"),
  cambiarPassword: (password_actual: string, password_nueva: string) =>
    api.post<void>("/auth/cambiar-password", { password_actual, password_nueva }),
};

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const roles = {
  // OJO: /roles es la UNICA lista que NO viene paginada: devuelve Rol[].
  listar: () => api.get<Rol[]>("/roles"),
  obtener: (id: number) => api.get<Rol>(`/roles/${id}`),
  crear: (datos: RolCrear) => api.post<Rol>("/roles", datos),
  actualizar: (id: number, datos: Partial<RolCrear> & { activo?: boolean }) =>
    api.patch<Rol>(`/roles/${id}`, datos),
  activar: (id: number) => api.post<Rol>(`/roles/${id}/activar`),
  desactivar: (id: number) => api.post<Rol>(`/roles/${id}/desactivar`),
  deUsuario: (idUsuario: number) =>
    api.get<RolesDeUsuario>(`/roles/usuario/${idUsuario}`),
  asignar: (idUsuario: number, idRol: number) =>
    api.post<RolesDeUsuario>(`/roles/usuario/${idUsuario}/asignar`, {
      id_rol: idRol,
    }),
  retirar: (idUsuario: number, idRol: number) =>
    api.post<RolesDeUsuario>(`/roles/usuario/${idUsuario}/retirar`, {
      id_rol: idRol,
    }),
};

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------
// NOTA: no hay POST /usuarios ni DELETE. Los usuarios se crean por
// /auth/registro, se editan con PATCH y se dan de baja con /inhabilitar
// (regla del proyecto: no se borra nada).

export const usuarios = {
  listar: (filtros: FiltrosUsuario = {}) =>
    api.get<Pagina<UsuarioDetalle>>(`/usuarios${aQuery(filtros)}`),
  obtener: (id: number) => api.get<UsuarioDetalle>(`/usuarios/${id}`),
  actualizar: (id: number, datos: UsuarioActualizar) =>
    api.patch<UsuarioDetalle>(`/usuarios/${id}`, datos),
  habilitar: (id: number) => api.post<UsuarioDetalle>(`/usuarios/${id}/habilitar`),
  inhabilitar: (id: number) =>
    api.post<UsuarioDetalle>(`/usuarios/${id}/inhabilitar`),
  restablecerPassword: (id: number, password_nueva: string) =>
    api.post<void>(`/usuarios/${id}/restablecer-password`, { password_nueva }),
};

/** Clientes = usuarios con rol 2 (no existe un endpoint /clientes aparte). */
export const clientes = {
  listar: (filtros: Omit<FiltrosUsuario, "id_rol"> = {}) =>
    api.get<Pagina<UsuarioDetalle>>(`/usuarios${aQuery({ ...filtros, id_rol: 2 })}`),
};

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------

export const productos = {
  listar: (filtros: FiltrosProducto = {}, opciones?: OpcionesPeticion) =>
    api.get<Pagina<Producto>>(`/productos${aQuery(filtros)}`, opciones),
  obtener: (id: number, opciones?: OpcionesPeticion) =>
    api.get<Producto>(`/productos/${id}`, opciones),
  crear: (datos: ProductoCrear) => api.post<Producto>("/productos", datos),
  subirImagen: (archivo: File) => {
    const formulario = new FormData();
    formulario.append("archivo", archivo);
    return api.post<{ imagen: string }>("/productos/imagen", formulario);
  },
  actualizar: (id: number, datos: Partial<ProductoCrear>) =>
    api.patch<Producto>(`/productos/${id}`, datos),
  habilitar: (id: number) => api.post<Producto>(`/productos/${id}/habilitar`),
  inhabilitar: (id: number) => api.post<Producto>(`/productos/${id}/inhabilitar`),
};

// ---------------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------------

export const inventario = {
  listar: (saltar = 0, limite = 50) =>
    api.get<Pagina<Inventario>>(
      `/inventario${aQuery({ saltar, limite })}`
    ),
  /** Stock total por producto (ya sumado de todas sus filas de talla/color). */
  stock: (saltar = 0, limite = 50) =>
    api.get<Pagina<StockPorProducto>>(
      `/inventario/stock${aQuery({ saltar, limite })}`
    ),
  alertas: (saltar = 0, limite = 50) =>
    api.get<Pagina<AlertaStock>>(
      `/inventario/alertas${aQuery({ saltar, limite })}`
    ),
  movimientos: (saltar = 0, limite = 50) =>
    api.get<Pagina<MovimientoInventario>>(
      `/inventario/movimientos${aQuery({ saltar, limite })}`
    ),
  obtener: (id: number) => api.get<Inventario>(`/inventario/${id}`),
  crear: (datos: {
    id_producto_fk: number;
    cantidad_actual?: number;
    stock_minimo?: number;
  }) => api.post<Inventario>("/inventario", datos),
  actualizar: (
    id: number,
    datos: { cantidad_actual?: number; stock_minimo?: number }
  ) => api.patch<Inventario>(`/inventario/${id}`, datos),
  entrada: (id: number, cantidad: number, motivo?: string) =>
    api.post<MovimientoInventario>(`/inventario/${id}/entrada`, { cantidad, motivo }),
  salida: (id: number, cantidad: number, motivo?: string) =>
    api.post<MovimientoInventario>(`/inventario/${id}/salida`, { cantidad, motivo }),
  ajuste: (id: number, cantidad_actual: number, motivo?: string) =>
    api.post<MovimientoInventario>(`/inventario/${id}/ajuste`, {
      cantidad_actual,
      motivo,
    }),
};

// ---------------------------------------------------------------------------
// Descuentos
// ---------------------------------------------------------------------------

export const descuentos = {
  listar: (saltar = 0, limite = 50) =>
    api.get<Pagina<Descuento>>(
      `/descuentos${aQuery({ saltar, limite })}`
    ),
  obtener: (id: number) => api.get<Descuento>(`/descuentos/${id}`),
  deProducto: (idProducto: number, opciones?: OpcionesPeticion) =>
    api.get<DescuentoVigente>(`/descuentos/producto/${idProducto}`, opciones),
  crear: (datos: {
    id_producto_fk: number;
    tipo_descuento: string;
    valor_descuento: number;
    fecha_inicio?: string | null;
    fecha_fin?: string | null;
  }) => api.post<Descuento>("/descuentos", datos),
  actualizar: (
    id: number,
    datos: { tipo_descuento?: string; valor_descuento?: number; fecha_inicio?: string | null; fecha_fin?: string | null }
  ) => api.patch<Descuento>(`/descuentos/${id}`, datos),
  activar: (id: number) => api.post<Descuento>(`/descuentos/${id}/activar`),
  desactivar: (id: number) => api.post<Descuento>(`/descuentos/${id}/desactivar`),
};

// ---------------------------------------------------------------------------
// Carrito
// ---------------------------------------------------------------------------
// Solo el usuario de la sesion tiene un carrito abierto (el backend lo resuelve
// con el token): no se manda id_usuario.

export const carrito = {
  obtener: () => api.get<Carrito>("/carrito"),
  agregar: (id_producto: number, cantidad = 1) =>
    api.post<Carrito>("/carrito/items", { id_producto, cantidad }),
  actualizarItem: (idDetalle: number, cantidad: number) =>
    api.patch<Carrito>(`/carrito/items/${idDetalle}`, { cantidad }),
  quitarItem: (idDetalle: number) =>
    api.post<Carrito>(`/carrito/items/${idDetalle}/quitar`),
  vaciar: () => api.post<Carrito>("/carrito/vaciar"),
};

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------
// El detalle de las lineas viene DENTRO del pedido (`items`), no en otra ruta.

export const pedidos = {
  listar: (filtros: FiltrosPedido = {}) =>
    api.get<Pagina<Pedido>>(`/pedidos${aQuery(filtros)}`),
  obtener: (id: number) => api.get<Pedido>(`/pedidos/${id}`),
  actualizarItems: (id: number, items: { id_producto: number; cantidad: number }[]) =>
    api.put<Pedido>(`/pedidos/${id}/items`, { items }),
  crear: (datos: { id_usuario?: number } = {}) =>
    api.post<Pedido>("/pedidos", datos),
  cambiarEstado: (id: number, estado: string, metodoPago?: string) =>
    api.patch<Pedido>(`/pedidos/${id}/estado`, {
      estado,
      ...(metodoPago ? { metodo_pago: metodoPago } : {}),
    }),
  cancelar: (id: number) => api.post<Pedido>(`/pedidos/${id}/cancelar`),
};

// ---------------------------------------------------------------------------
// Ventas
// ---------------------------------------------------------------------------
// No hay POST /ventas: la venta se crea sola al pasar el pedido a "Entregado".

export const ventas = {
  listar: (filtros: FiltrosVenta = {}) =>
    api.get<Pagina<Venta>>(`/ventas${aQuery(filtros)}`),
  obtener: (id: number) => api.get<Venta>(`/ventas/${id}`),
  anular: (id: number) => api.post<Venta>(`/ventas/${id}/anular`),
  facturaInterna: (id: number) => api.get<unknown>(`/ventas/${id}/factura`),
  ingresosPorMes: () =>
    api.get<IngresoPorMes[]>(`/ventas/estadisticas/ingresos-por-mes`),
  reporteVendedor: (filtros: {
    fecha_desde?: string;
    fecha_hasta?: string;
    estado?: string;
  } = {}) => api.get<ReporteVendedor>(`/ventas/reportes/vendedor${aQuery(filtros)}`),
};

// ---------------------------------------------------------------------------
// Devoluciones
// ---------------------------------------------------------------------------

export const devoluciones = {
  listar: (
    filtros: {
      estado?: string;
      id_detalle_venta?: number;
      saltar?: number;
      limite?: number;
    } = {}
  ) => api.get<Pagina<Devolucion>>(`/devoluciones${aQuery(filtros)}`),
  obtener: (id: number) => api.get<Devolucion>(`/devoluciones/${id}`),
  crear: (datos: DevolucionCrear) => api.post<Devolucion>("/devoluciones", datos),
  cambiarEstado: (id: number, estado: string) =>
    api.patch<Devolucion>(`/devoluciones/${id}/estado`, { estado }),
  aprobar: (id: number) => api.post<Devolucion>(`/devoluciones/${id}/aprobar`),
  rechazar: (id: number) => api.post<Devolucion>(`/devoluciones/${id}/rechazar`),
};

// ---------------------------------------------------------------------------
// Facturacion electronica (DIAN)
// ---------------------------------------------------------------------------

export const facturas = {
  listar: (saltar = 0, limite = 50) =>
    api.get<Pagina<FacturaElectronica>>(
      `/facturas-electronicas${aQuery({ saltar, limite })}`
    ),
  obtener: (id: number) =>
    api.get<FacturaElectronica>(`/facturas-electronicas/${id}`),
  porVenta: (idVenta: number) =>
    api.get<FacturaElectronica>(
      `/facturas-electronicas/por-venta/${idVenta}`
    ),
  crear: (datos: {
    id_venta: number;
    tipo_documento?: string;
  }) => api.post<FacturaElectronica>("/facturas-electronicas", datos),
  lineas: (id: number) =>
    api.get<LineaFactura[]>(`/facturas-electronicas/${id}`),
  eventos: (id: number) =>
    api.get<EventoFactura[]>(`/facturas-electronicas/${id}/eventos`),
  xml: (id: number) =>
    api.get<{ xml: string }>(`/facturas-electronicas/${id}/xml`),
  firmar: (id: number) =>
    api.post<FacturaElectronica>(`/facturas-electronicas/${id}/firmar`),
  enviar: (id: number) =>
    api.post<FacturaElectronica>(`/facturas-electronicas/${id}/enviar`),
  consultarEstado: (id: number) =>
    api.post<FacturaElectronica>(
      `/facturas-electronicas/${id}/consultar-estado`
    ),
  anular: (id: number) =>
    api.post<FacturaElectronica>(`/facturas-electronicas/${id}/anular`),
  resoluciones: (saltar = 0, limite = 50) =>
    api.get<Pagina<Resolucion>>(
      `/facturas-electronicas/resoluciones${aQuery({ saltar, limite })}`
    ),
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/**
 * Recorre TODAS las paginas de una lista y devuelve los items juntos.
 *
 * El backend limita `limite` a 100, asi que pedir 500 da error 422. Para
 * totales (por ejemplo los ingresos del panel) hay que ir pagina por pagina.
 */
export async function traerTodo<T>(
  pedir: (saltar: number, limite: number) => Promise<Pagina<T>>,
  maximoPaginas = 50
): Promise<{ items: T[]; total: number }> {
  const LIMITE = 100;
  const items: T[] = [];
  let saltar = 0;
  let total = 0;

  for (let pagina = 0; pagina < maximoPaginas; pagina++) {
    const respuesta = await pedir(saltar, LIMITE);
    total = respuesta.total;
    items.push(...respuesta.items);
    if (items.length >= respuesta.total || respuesta.items.length === 0) break;
    saltar += LIMITE;
  }

  return { items, total };
}

/** Convierte los textos decimales del backend ("30000.00") a numero. */
export const numero = (valor: string | number | null | undefined): number =>
  valor === null || valor === undefined ? 0 : Number(valor);

/** Formatea en pesos colombianos, sin decimales. */
export const pesos = (valor: string | number | null | undefined): string =>
  numero(valor).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

// Bandeja IMAP de entrada, disponible únicamente para administradores.
export interface CorreoContacto {
  uid: number;
  nombre: string;
  correo: string | null;
  remitente: string | null;
  asunto: string;
  tipo: "formulario" | "correo";
  mensaje: string;
  fecha: string;
}
export interface BandejaContacto {
  uidvalidity: number;
  items: CorreoContacto[];
  siguiente_antes: number | null;
}
export interface ResultadoCorreo {
  uid: number;
  correo: string;
  estado: "aceptado" | "rechazado" | "desconocido" | "no_enviado";
}
export const correosAdmin = {
  listar: (antes?: number) => api.get<BandejaContacto>(`/correos-admin${aQuery({ antes })}`, { redirigirEnError: false }),
  responder: (datos: { uids: number[]; uidvalidity: number; asunto: string; mensaje: string }) =>
    api.post<{ resultados: ResultadoCorreo[] }>("/correos-admin/responder", datos, { redirigirEnError: false }),
};
