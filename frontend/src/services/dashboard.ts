// src/services/dashboard.ts
//
// Resumen del panel. El backend NO tiene un endpoint de estadisticas: se arma
// aqui juntando varias listas.
//
// OJO: todas las listas estan paginadas y el backend limita `limite` a 100.
// Con 3 ventas da igual, pero con 300 los ingresos saldrian mal si se pidiera
// una sola pagina. Por eso se usa `traerTodo`, que recorre todas.

import { inventario, numero, pedidos, traerTodo, usuarios, ventas } from "./api";

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
    const [todasVentas, todosPedidos, clientes, stock] = await Promise.all([
      traerTodo((saltar, limite) => ventas.listar({ saltar, limite })),
      traerTodo((saltar, limite) => pedidos.listar({ saltar, limite })),
      usuarios.listar({ id_rol: 2, limite: 1 }),
      traerTodo((saltar, limite) => inventario.stock(saltar, limite)),
    ]);

    const ventasCompletadas = todasVentas.items.filter(
      (v) => v.estado === "Completada"
    );

    const ingresos = ventasCompletadas.reduce(
      (suma, v) => suma + numero(v.total_pagado),
      0
    );

    const pendientes = todosPedidos.items.filter(
      (p) => !ESTADOS_PEDIDO_CERRADO.includes(p.estado ?? "")
    ).length;

    const bajoStock = stock.items.filter(
      (s) => s.bajo_minimo && !s.inhabilitado
    ).length;

    return {
      total_ventas: ventasCompletadas.length,
      ingresos_totales: ingresos,
      // `total` es el conteo real de la base, no solo lo que cabe en una pagina.
      total_pedidos: todosPedidos.total,
      pedidos_pendientes: pendientes,
      total_clientes: clientes.total,
      productos_bajo_stock: bajoStock,
    };
  },
};
