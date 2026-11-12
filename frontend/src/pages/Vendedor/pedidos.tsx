import React, { useState } from 'react';

const PedidosVendedor = () => {
  const [Pedidos, setPedidos] = useState([
    { id: 101, cliente: 'Juan Pérez', estado: 'Pendiente', total: 300000, fecha: '2026-11-12' },
    { id: 102, cliente: 'María García', estado: 'En Proceso', total: 450000, fecha: '2026-11-11' },
    { id: 103, cliente: 'Carlos Ruiz', estado: 'Entregado', total: 120000, fecha: '2026-11-10' },
  ]);

  const estados = ['Pendiente', 'En Proceso', 'Entregado', 'Cancelado'];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Lista de Pedidos</h1>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white shadow rounded-lg">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border-b text-left">Pedido ID</th>
              <th className="p-3 border-b text-left">Cliente</th>
              <th className="p-3 border-b text-left">Estado</th>
              <th className="p-3 border-b text-left">Total</th>
              <th className="p-3 border-b text-left">Fecha</th>
              <th className="p-3 border-b text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {Pedidos.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="p-3 border-b">{p.id}</td>
                <td className="p-3 border-b">{p.cliente}</td>
                <td className="p-3 border-b">
                  <span className={`px-2 py-1 rounded text-sm ${
                    p.estado === 'Entregado' ? 'bg-green-100 text-green-800' :
                    p.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {p.estado}
                  </span>
                </td>
                <td className="p-3 border-b">${p.total}</td>
                <td className="p-3 border-b">{p.fecha}</td>
                <td className="p-3 border-b">
                  <button className="text-blue-600 hover:underline text-sm">Ver</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PedidosVendedor;