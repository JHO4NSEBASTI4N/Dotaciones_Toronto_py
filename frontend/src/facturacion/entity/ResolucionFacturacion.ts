// src/facturacion/entity/ResolucionFacturacion.ts
//
// Resolucion de numeracion autorizada por la DIAN.
// Equivale a la clase ResolucionFacturacion.java del proyecto Java.

export interface Resolucion {
  id_resolucion: number;
  tipo_documento: string;
  numero_resolucion: string;
  prefijo: string;
  rango_desde: number;
  rango_hasta: number;
  clave_tecnica: string;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  notificacion: string | null;
  consecutivo_actual: number;
  vigente: boolean;
}
