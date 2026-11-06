// src/services/dashboard.ts

import { clientes, inventario, pedidos, ventas } from "./api";

export interface ResumenDashboard {
  total_ventas: number;
  ingresos_totales: number;
  total_pedidos: number;
  pedidos_pendientes: number;
  total_clientes: number;
  productos_bajo_stock: number;
}

const ESTADOS_PEDIDO_CERRADO = ["Entregado", "Cancelado"];

export const dashboard = {
  async resumen(): Promise<ResumenDashboard> {
    const [listaVentas, listaPedidos, listaClientes, listaInventario] =
      await Promise.all([
        ventas.listar(),
        pedidos.listar(),
        clientes.listar(),
        inventario.listar(),
      ]);

    const ventasCompletadas = listaVentas.filter(
      (v) => v.estado === "Completada"
    );

    const ingresosTotales = ventasCompletadas.reduce(
      (suma, v) => suma + Number(v.total_pagado ?? 0),
      0
    );

    const pedidosPendientes = listaPedidos.filter(
      (p) => !ESTADOS_PEDIDO_CERRADO.includes(p.estado ?? "")
    ).length;

    const bajoStock = listaInventario.filter(
      (i) =>
        !i.inhabilitado &&
        i.cantidad_actual !== null &&
        i.stock_minimo !== null &&
        i.cantidad_actual <= i.stock_minimo
    ).length;

    return {
      total_ventas: ventasCompletadas.length,
      ingresos_totales: ingresosTotales,
      total_pedidos: listaPedidos.length,
      pedidos_pendientes: pedidosPendientes,
      total_clientes: listaClientes.length,
      productos_bajo_stock: bajoStock,
    };
  },
};