// src/entity/MovimientoInventario.ts
//
// Tabla `movimiento_inventario`: historial de entradas, salidas y ajustes.
// Equivale a la clase MovimientoInventario.java del proyecto Java.

export interface MovimientoInventario {
  id: number;
  id_inventario: number | null;
  nombre_producto: string | null;
  tipo_movimiento: string | null; // ENTRADA | SALIDA | AJUSTE
  cantidad: number | null;
  motivo: string | null;
  usuario_responsable: string | null;
  fecha_hora: string | null;
}
