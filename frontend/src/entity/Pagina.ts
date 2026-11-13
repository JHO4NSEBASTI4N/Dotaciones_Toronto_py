// src/entity/Pagina.ts
//
// Paginacion tal como la devuelve el backend ({total, saltar, limite, items}).
// Equivale a la clase Pagina.java del proyecto Java.

export interface Pagina<T> {
  total: number;
  saltar: number;
  limite: number;
  items: T[];
}

export interface ParametrosPagina {
  saltar?: number;
  limite?: number;
}

/** Parametros de paginacion que aceptan todas las listas del backend. */
export interface ParametrosPagina {
  saltar?: number;
  limite?: number;
}
