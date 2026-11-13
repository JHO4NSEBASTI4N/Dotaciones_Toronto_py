// src/entity/Venta.ts
//
// Tabla `venta` y su detalle.
// Equivale a la clase Venta.java del proyecto Java.

import type { ParametrosPagina } from "./Pagina";

export interface Venta {
  id_venta: number;
  id_usuario_fk: number | null;
  id_pedido_fk: number | null;
  fecha_venta: string | null;
  estado: string; // Completada | Anulada
  items: DetalleVenta[];
  factura: FacturaInterna | null;
  total_unidades: number;
  subtotal_lista: string;
  descuento_total: string;
  total_pagado: string;
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
