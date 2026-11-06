// src/types/index.ts
// Nombres idénticos a las columnas de la base de datos `dotacionestoronto`

export interface Rol {
  id_rol: number;
  nombre_rol: string | null;
  descripcion_rol: string | null;
  activo: boolean;
}

export interface Usuario {
  id_usuario: number;
  nombre: string;
  documento: string | null;
  correo: string;
  telefono: string | null;
  password?: string; // nunca se muestra; solo se envía al crear o editar
  direccion: string | null;
  estado: string | null; // "Habilitado" | "Inhabilitado"
  id_rol_fk: number | null;
}

export interface UsuarioRol {
  id_usuario_rol: number;
  id_usuario_fk: number;
  id_rol_fk: number;
  activo: boolean;
}

export interface Producto {
  id_producto: number;
  nombre: string;
  precio: number;
  talla: string | null;
  color: string | null;
  imagen: string | null;
  estado: string | null;
  inhabilitado: boolean;
  categoria: string;
}

export interface Inventario {
  id_inventario: number;
  id_producto_fk: number | null;
  cantidad_actual: number | null;
  stock_minimo: number | null;
  inhabilitado: boolean;
}

export interface MovimientoInventario {
  id: number;
  id_inventario: number | null;
  nombre_producto: string | null;
  tipo_movimiento: "ENTRADA" | "SALIDA" | "AJUSTE" | string | null;
  cantidad: number | null;
  motivo: string | null;
  usuario_responsable: string | null;
  fecha_hora: string | null;
}

export interface Pedido {
  id_pedido: number;
  id_usuario_fk: number | null;
  fecha_pedido: string | null;
  estado: string | null;
  oculto: boolean;
}

export interface DetallePedido {
  id_detalle_pedido: number;
  id_pedido_fk: number | null;
  id_producto_fk: number | null;
  precio_unitario: number | null;
  cantidad: number | null;
  inhabilitado: boolean;
  precio_lista: number | null;
  descuento_unitario: number;
}

export interface Venta {
  id_venta: number;
  id_usuario_fk: number | null;
  id_pedido_fk: number | null;
  fecha_venta: string | null;
  total_pagado: number | null;
  estado: string;
}

export interface DetalleVenta {
  id_detalle_venta: number;
  id_venta_fk: number | null;
  id_producto_fk: number | null;
  cantidad: number | null;
  precio_unitario: number | null;
  inhabilitado: boolean;
  precio_lista: number | null;
  descuento_unitario: number;
}

export interface Devolucion {
  id_devolucion: number;
  id_detalle_venta_fk: number | null;
  cantidad: number | null;
  motivo: string | null;
  fecha_devolucion: string | null;
  estado: string | null;
}

export interface FacturaElectronica {
  id_factura: number;
  id_venta_fk: number | null;
  id_pedido_fk: number | null;
  id_cliente_fk: number | null;
  numero_factura: string;
  prefijo: string | null;
  consecutivo: number | null;
  fecha_emision: string | null;
  estado: string | null;
  cufe: string | null;
  valor_bruto: number;
  descuento_total: number;
  total_iva: number;
  total_impuestos: number;
  total_factura: number;
  moneda: string;
  estado_dian: string | null;
  mensaje_dian: string | null;
  track_id: string | null;
  simulado: boolean;
  qr_url: string | null;
}

export interface FacturaElectronicaDetalle {
  id_detalle_factura: number;
  id_factura_fk: number;
  numero_linea: number | null;
  codigo_producto: string | null;
  descripcion: string | null;
  cantidad: number | null;
  unidad_medida: string;
  precio_unitario: number | null;
  descuento: number;
  iva_porcentaje: number;
  iva_valor: number;
  total_linea: number;
}

export interface ResolucionFacturacion {
  id_resolucion: number;
  tipo_documento: string;
  numero_resolucion: string | null;
  prefijo: string | null;
  rango_desde: number | null;
  rango_hasta: number | null;
  consecutivo_actual: number | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  vigente: boolean;
}

// Autenticación
export interface LoginRequest {
  correo: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}

export interface RegistroRequest {
  nombre: string;
  documento: string;
  correo: string;
  telefono: string;
  direccion: string;
  password: string;
}