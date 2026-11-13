// src/entity/Carrito.ts
//
// Tabla `carrito` y su detalle.
// Equivale a la clase Carrito.java del proyecto Java.

export interface Carrito {
  id_carrito: number;
  fecha_creacion: string | null;
  items: ItemCarrito[];
  total_unidades: number;
  subtotal_lista: string;
  descuento_total: string;
  total: string;
}

export interface ItemCarrito {
  id_detalle_carrito: number;
  id_producto: number | null;
  nombre: string | null;
  talla: string | null;
  color: string | null;
  imagen: string | null;
  cantidad: number;
  precio_lista: string;
  descuento_unitario: string;
  precio_unitario: string;
  subtotal_lista: string;
  descuento_total: string;
  subtotal: string;
  stock_disponible: number | null;
}
