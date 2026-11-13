// src/entity/index.ts
//
// Re-exporta todas las entidades para poder importar
//   import type { Producto, Pedido } from "../entity";

export * from "./Carrito";
export * from "./Descuento";
export * from "./Devolucion";
export * from "./Inventario";
export * from "./MovimientoInventario";
export * from "./Pagina";
export * from "./Pedido";
export * from "./Producto";
export * from "./Rol";
export * from "./Usuario";
export * from "./UsuarioRol";
export * from "./Venta";
export * from "../facturacion/entity/EventoFactura";
export * from "../facturacion/entity/FacturaElectronica";
export * from "../facturacion/entity/ResolucionFacturacion";
