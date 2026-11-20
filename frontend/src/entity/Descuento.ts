// src/entity/Descuento.ts
//
// Tabla `descuento` (se aplica en el pedido, no en la venta).
// Equivale a la clase Descuento.java del proyecto Java.

export interface Descuento {
  id_descuento: number;
  id_producto_fk: number;
  tipo_descuento: "PORCENTAJE" | "FIJO";
  valor_descuento: string;
  activo: boolean;
  fecha_inicio: string | null;
  fecha_fin: string | null;
}

export interface DescuentoVigente {
  descuento: Descuento;
  precio_lista: string;
  descuento_unitario: string;
  precio_unitario: string;
}
