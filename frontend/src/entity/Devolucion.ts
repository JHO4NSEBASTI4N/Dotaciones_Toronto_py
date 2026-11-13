// src/entity/Devolucion.ts
//
// Tabla `devolucion`. Aprobar NO toca el stock.
// Equivale a la clase Devolucion.java del proyecto Java.

export interface Devolucion {
  id_devolucion: number;
  id_detalle_venta_fk: number | null;
  cantidad: number;
  motivo: string | null;
  fecha_devolucion: string | null;
  estado: string; // Pendiente | Aprobada | Rechazada
  id_venta: number | null;
  id_producto: number | null;
  nombre_producto: string | null;
  cantidad_vendida: number | null;
  cantidad_devuelta: number | null;
  cantidad_disponible: number | null;
  valor_unitario: string | null;
  valor_devuelto: string | null;
}

export interface DevolucionCrear {
  id_detalle_venta: number;
  cantidad: number;
  motivo?: string | null;
}
