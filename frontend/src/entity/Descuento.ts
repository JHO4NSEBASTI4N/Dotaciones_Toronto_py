// src/entity/Descuento.ts
//
// Tabla `descuento` (se aplica en el pedido, no en la venta).
// Equivale a la clase Descuento.java del proyecto Java.

export interface Descuento {
  id_descuento: number;
  id_producto_fk: number;
  tipo_descuento: string; // PORCENTAJE | VALOR_FIJO
  valor_descuento: string;
  activo: boolean;
}

export interface DescuentoVigente {
  descuento: Descuento | null;
  precio_lista: string;
  descuento_unitario: string;
  precio_unitario: string;
}
