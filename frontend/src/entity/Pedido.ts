// src/entity/Pedido.ts
//
// Tabla `pedido` y su detalle.
// Equivale a la clase Pedido.java del proyecto Java.

import type { ParametrosPagina } from "./Pagina";

export interface Pedido {
  id_pedido: number;
  id_usuario_fk: number | null;
  fecha_pedido: string | null;
  estado: string | null; // Pendiente | Enviado | Entregado | Cancelado
  oculto: boolean;
  items: ItemPedido[];
  total_unidades: number;
  subtotal_lista: string;
  descuento_total: string;
  total: string;
}

export interface ItemPedido {
  id_detalle_pedido: number;
  id_producto: number | null;
  nombre_producto: string | null;
  cantidad: number;
  precio_lista: string;
  descuento_unitario: string;
  precio_unitario: string;
  subtotal_lista: string;
  descuento_total: string;
  subtotal: string;
}

export interface FiltrosPedido extends ParametrosPagina {
  estado?: string;
  id_usuario?: number;
  incluir_ocultos?: boolean;
}
