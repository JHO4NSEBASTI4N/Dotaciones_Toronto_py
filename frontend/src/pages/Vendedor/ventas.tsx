import React, { useState } from 'react';

const VentasVendedor = () => {
  const [ventas, setVentas] = useState([
    { id: 1, producto: 'Camisa Toronto', cantidad: 5, total: 150000, fecha: '2026-11-10' },
    { id: 2, producto: 'Pantalón Toronto', cantidad: 2, total: 120000, fecha: '2026-11-11' },
  ]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Registro de Ventas</h1>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white shadow rounded-lg">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border-b text-left">ID</th>
              <th className="p-3 border-b text-left">Producto</th>
              <th className="p-3 border-b text-left">Cantidad</th>
              <th className="p-3 border-b text-left">Total</th>
              <th className="p-3 border-b text-left">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.id} className="hover:bg-gray-50">
                <td className="p-3 border-b">{v.id}</td>
                <td className="p-3 border-b">{v.producto}</td>
                <td className="p-3 border-b">{v.cantidad}</td>
                <td className="p-3 border-b">${v.total}</td>
                <td className="p-3 border-b">{v.fecha}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="mt-6 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Nueva Venta
      </button>
    </div>
  );
};

export default VentasVendedor;