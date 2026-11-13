// src/facturacion/entity/FacturaElectronica.ts
//
// Modulo de facturacion electronica (DIAN).
// Equivale a la clase FacturaElectronica.java del proyecto Java.

export interface FacturaElectronica {
  id_factura: number;
  id_venta_fk: number | null;
  id_pedido_fk: number | null;
  id_cliente_fk: number | null;
  tipo_documento: string | null;
  numero_factura: string;
  prefijo: string | null;
  consecutivo: number | null;
  fecha_emision: string | null;
  estado: string | null;
  cufe: string | null;
  valor_bruto: number | null;
  descuento_total: number | null;
  total_iva: number | null;
  total_impuestos: number | null;
  total_factura: number | null;
  moneda: string | null;
  nit_emisor: string | null;
  razon_social_emisor: string | null;
  nit_adquirente: string | null;
  razon_social_adquirente: string | null;
  estado_dian: string | null;
  mensaje_dian: string | null;
  track_id: string | null;
  fecha_envio: string | null;
  fecha_respuesta: string | null;
  intentos: number | null;
  firmado: boolean;
  simulado: boolean;
  creado_en: string | null;
}

export interface LineaFactura {
  id_detalle_factura: number;
  numero_linea: number;
  codigo_producto: string | null;
  descripcion: string | null;
  cantidad: number;
  unidad_medida: string | null;
  precio_unitario: number;
  descuento: number;
  iva_porcentaje: number;
  iva_valor: number;
  total_linea: number;
}
