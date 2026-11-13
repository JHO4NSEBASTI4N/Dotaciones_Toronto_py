// src/facturacion/entity/EventoFactura.ts
//
// Eventos de la factura electronica (firmado, enviado, aceptado...).
// Equivale a la clase EventoFactura.java del proyecto Java.

export interface EventoFactura {
  id_evento: number;
  fecha: string | null;
  tipo: string | null;
  estado: string | null;
  mensaje: string | null;
}
