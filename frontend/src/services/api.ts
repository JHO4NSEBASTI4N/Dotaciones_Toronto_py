// src/services/api.ts

import type {
  Rol,
  Usuario,
  UsuarioRol,
  Producto,
  Inventario,
  MovimientoInventario,
  Pedido,
  DetallePedido,
  Venta,
  DetalleVenta,
  Devolucion,
  FacturaElectronica,
  FacturaElectronicaDetalle,
  ResolucionFacturacion,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type Metodo = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// ---------- Cliente base ----------

async function peticion<T>(
  endpoint: string,
  metodo: Metodo = "GET",
  cuerpo?: unknown
): Promise<T> {
  const token = localStorage.getItem("token");

  const respuesta = await fetch(`${BASE_URL}${endpoint}`, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });

  if (!respuesta.ok) {
    // Token vencido o inválido: limpiar sesión
    if (respuesta.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
    }

    let mensaje = `Error ${respuesta.status}`;
    try {
      const data = await respuesta.json();
      mensaje = data.detail ?? data.message ?? mensaje;
    } catch {
      // la respuesta no traía JSON
    }
    throw new Error(mensaje);
  }

  if (respuesta.status === 204) return undefined as T;
  return respuesta.json() as Promise<T>;
}

export const api = {
  get: <T>(endpoint: string) => peticion<T>(endpoint, "GET"),
  post: <T>(endpoint: string, cuerpo?: unknown) =>
    peticion<T>(endpoint, "POST", cuerpo),
  put: <T>(endpoint: string, cuerpo?: unknown) =>
    peticion<T>(endpoint, "PUT", cuerpo),
  patch: <T>(endpoint: string, cuerpo?: unknown) =>
    peticion<T>(endpoint, "PATCH", cuerpo),
  delete: <T>(endpoint: string) => peticion<T>(endpoint, "DELETE"),
};

// ---------- Roles y usuarios ----------

export const roles = {
  listar: () => api.get<Rol[]>("/roles"),
};

export const usuarios = {
  listar: () => api.get<Usuario[]>("/usuarios"),
  obtener: (id: number) => api.get<Usuario>(`/usuarios/${id}`),
  crear: (datos: Omit<Usuario, "id_usuario">) =>
    api.post<Usuario>("/usuarios", datos),
  actualizar: (id: number, datos: Partial<Usuario>) =>
    api.put<Usuario>(`/usuarios/${id}`, datos),
  eliminar: (id: number) => api.delete<void>(`/usuarios/${id}`),
  roles: (id: number) => api.get<UsuarioRol[]>(`/usuarios/${id}/roles`),
};

// Clientes = usuarios con id_rol_fk = 2
export const clientes = {
  listar: () => api.get<Usuario[]>("/clientes"),
  obtener: (id: number) => api.get<Usuario>(`/clientes/${id}`),
  crear: (datos: Omit<Usuario, "id_usuario">) =>
    api.post<Usuario>("/clientes", datos),
  actualizar: (id: number, datos: Partial<Usuario>) =>
    api.put<Usuario>(`/clientes/${id}`, datos),
  eliminar: (id: number) => api.delete<void>(`/clientes/${id}`),
};

// ---------- Productos e inventario ----------

export const productos = {
  listar: () => api.get<Producto[]>("/productos"),
  obtener: (id: number) => api.get<Producto>(`/productos/${id}`),
  crear: (datos: Omit<Producto, "id_producto">) =>
    api.post<Producto>("/productos", datos),
  actualizar: (id: number, datos: Partial<Producto>) =>
    api.put<Producto>(`/productos/${id}`, datos),
  eliminar: (id: number) => api.delete<void>(`/productos/${id}`),
};

export const inventario = {
  listar: () => api.get<Inventario[]>("/inventario"),
  obtener: (id: number) => api.get<Inventario>(`/inventario/${id}`),
  crear: (datos: Omit<Inventario, "id_inventario">) =>
    api.post<Inventario>("/inventario", datos),
  actualizar: (id: number, datos: Partial<Inventario>) =>
    api.put<Inventario>(`/inventario/${id}`, datos),
};

export const movimientosInventario = {
  listar: () => api.get<MovimientoInventario[]>("/movimientos-inventario"),
  crear: (datos: Omit<MovimientoInventario, "id" | "fecha_hora">) =>
    api.post<MovimientoInventario>("/movimientos-inventario", datos),
};

// ---------- Pedidos y ventas ----------

export const pedidos = {
  listar: () => api.get<Pedido[]>("/pedidos"),
  obtener: (id: number) => api.get<Pedido>(`/pedidos/${id}`),
  detalle: (id: number) => api.get<DetallePedido[]>(`/pedidos/${id}/detalle`),
  crear: (datos: Omit<Pedido, "id_pedido" | "fecha_pedido">) =>
    api.post<Pedido>("/pedidos", datos),
  cambiarEstado: (id: number, estado: string) =>
    api.patch<Pedido>(`/pedidos/${id}`, { estado }),
};

export const ventas = {
  listar: () => api.get<Venta[]>("/ventas"),
  obtener: (id: number) => api.get<Venta>(`/ventas/${id}`),
  detalle: (id: number) => api.get<DetalleVenta[]>(`/ventas/${id}/detalle`),
  crear: (datos: Omit<Venta, "id_venta" | "fecha_venta">) =>
    api.post<Venta>("/ventas", datos),
};

export const devoluciones = {
  listar: () => api.get<Devolucion[]>("/devoluciones"),
  crear: (datos: Omit<Devolucion, "id_devolucion" | "fecha_devolucion">) =>
    api.post<Devolucion>("/devoluciones", datos),
  cambiarEstado: (id: number, estado: string) =>
    api.patch<Devolucion>(`/devoluciones/${id}`, { estado }),
};

// ---------- Facturación electrónica ----------

export const facturas = {
  listar: () => api.get<FacturaElectronica[]>("/facturas"),
  obtener: (id: number) => api.get<FacturaElectronica>(`/facturas/${id}`),
  detalle: (id: number) =>
    api.get<FacturaElectronicaDetalle[]>(`/facturas/${id}/detalle`),
  generarDesdeVenta: (idVenta: number) =>
    api.post<FacturaElectronica>(`/facturas/venta/${idVenta}`),
};

export const resoluciones = {
  listar: () => api.get<ResolucionFacturacion[]>("/resoluciones"),
};