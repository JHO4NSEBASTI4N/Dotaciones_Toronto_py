// src/entity/Producto.ts
//
// Tabla `producto`.
// Equivale a la clase Producto.java del proyecto Java.

import type { ParametrosPagina } from "./Pagina";

export interface Producto {
  id_producto: number;
  nombre: string;
  /** OJO: el backend lo manda como texto ("30000.00"). Usa Number(). */
  precio: string;
  talla: string | null;
  color: string | null;
  imagen: string | null;
  categoria: string;
  estado: string | null;
  inhabilitado: boolean;
}

export interface ProductoCrear {
  nombre: string;
  precio: number | string;
  talla?: string | null;
  color?: string | null;
  imagen?: string | null;
  categoria: string;
}

export interface FiltrosProducto extends ParametrosPagina {
  nombre?: string;
  categoria?: string;
  talla?: string;
  color?: string;
  incluir_inhabilitados?: boolean;
}
