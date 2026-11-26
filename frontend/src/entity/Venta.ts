// src/entity/Venta.ts
//
// Tabla `venta` y su detalle.
// Equivale a la clase Venta.java del proyecto Java.

import type { ParametrosPagina } from "./Pagina";

export interface Venta {
  id_venta: number;
  id_usuario_fk: number | null;
  id_pedido_fk: number | null;
  cliente?: ClienteVenta | null;
  fecha_venta: string | null;
  estado: string; // Completada | Anulada
  items: DetalleVenta[];
  factura: FacturaInterna | null;
  total_unidades: number;
  subtotal_lista: string;
  descuento_total: string;
  total_pagado: string;
}

export interface ClienteVenta {
  id_usuario: number;
  nombre: string;
  correo: string;
  telefono: string | null;
  direccion: string | null;
}

export interface DetalleVenta {
  id_detalle_venta: number;
  id_producto: number | null;
  nombre_producto: string | null;
  cantidad: number;
  precio_lista: string;
  descuento_unitario: string;
  precio_unitario: string;
  subtotal_lista: string;
  descuento_total: string;
  subtotal: string;
  cantidad_devuelta: number;
}

export interface FacturaInterna {
  id_factura: number;
  id_venta_fk: number | null;
  total_factura: string;
  fecha_factura: string | null;
  estado: string | null;
}

export interface FiltrosVenta extends ParametrosPagina {
  estado?: string;
  id_usuario?: number;
  id_pedido?: number;
}

/** Datos para la grafica de ingresos por mes (endpoint /ventas/estadisticas). */
export interface IngresoPorMes {
  /** Mes en formato "YYYY-MM". */
  periodo: string;
  /** Ingreso del mes (string con decimales, p. ej. "1540000.00"). */
  ingreso: string;
  /** Cantidad de ventas completadas en el mes. */
  ventas: number;
}

/** Datos de la empresa que salen impresos en los reportes. */
export interface Empresa {
  razon_social: string;
  nombre_comercial: string;
  nit: string;
  dv: string;
  direccion: string;
  ciudad: string;
  telefono: string;
  correo: string;
}

/** Reporte del vendedor (endpoint /ventas/reportes/vendedor). */
export interface ReporteVendedor {
  empresa: Empresa;
  filtros: {
    fecha_desde: string | null;
    fecha_hasta: string | null;
    estado: string | null;
  };
  resumen: {
    ventas: number;
    total_unidades: number;
    total_ingresos: number;
  };
  metodos_pago: {
    metodo: string;
    ingreso: number;
    ventas: number;
  }[];
  transacciones: {
    id_venta: number;
    fecha_venta: string | null;
    estado: string;
    total_pagado: number;
    total_unidades: number;
    metodo_pago: string | null;
    cliente: string;
  }[];
}
