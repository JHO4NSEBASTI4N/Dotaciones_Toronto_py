// src/entity/Inventario.ts
//
// Tabla `inventario` (una fila por talla/color).
// Equivale a la clase Inventario.java del proyecto Java.

export interface Inventario {
  id_inventario: number;
  id_producto_fk: number | null;
  cantidad_actual: number | null;
  stock_minimo: number | null;
  inhabilitado: boolean;
}

export interface StockPorProducto {
  id_producto: number;
  nombre: string;
  categoria: string | null;
  talla: string | null;
  color: string | null;
  stock_total: number;
  stock_minimo: number;
  bajo_minimo: boolean;
  filas_inventario: number;
  inhabilitado: boolean;
}

export interface AlertaStock {
  id_alerta: number;
  id_producto_fk: number | null;
  nivel_stock: string | null;
  fecha_alerta: string | null;
}
