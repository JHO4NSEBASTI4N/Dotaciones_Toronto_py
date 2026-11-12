import React, { useState } from 'react';

const devolucionesVendedor = () => {
  const [devoluciones, setDevoluciones] = useState([
    { id: 501, producto: 'Camisa Toronto', motivo: 'Talla incorrecta', estado: 'Pendiente', fecha: '2026-11-12' },
    { id: 502, producto: 'Pantalón Toronto', motivo: 'Defecto', estado: 'Aprobada', fecha: '2026-11-11' },
  ]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-red-700">Gestión de Devoluciones</h1>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white shadow rounded-lg">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border-b text-left">ID</th>
              <th className="p-3 border-b text-left">Producto</th>
              <th className="p-3 border-b text-left">Motivo</th>
              <th className="p-3 border-b text-left">Estado</th>
              <th className="p-3 border-b text-left">Fecha</th>
              <th className="p-3 border-b text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {devoluciones.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="p-3 border-b">{d.id}</td>
                <td className="p-3 border-b">{d.producto}</td>
                <td className="p-3 border-b">{d.motivo}</td>
                <td className="p-3 border-b">
                  <span className={`px-2 py-1 rounded text-sm ${
                    d.estado === 'Aprobada' ? 'bg-green-100 text-green-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {d.estado}
                  </span>
                </td>
                <td className="p-3 border-b">{d.fecha}</td>
                <td className="p-3 border-b">
                  <button className="text-blue-600 hover:underline text-sm">Revisar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">Procesar Nueva Devolución</h3>
        <form className="flex gap-4">
          <input type="text" placeholder="ID de Pedido" className="border p-2 rounded" />
          <input type="text" placeholder="Motivo" className="border p-2 rounded flex-1" />
          <button className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Registrar</button>
        </form>
      </div>
    </div>
  );
};

export default devolucionesVendedor;