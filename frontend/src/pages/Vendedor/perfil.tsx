import React, { useState } from 'react';

const PerfilVendedor = () => {
  const [datos, setDatos] = useState({
    nombre: 'Nombre del Vendedor',
    email: 'vendedor@toronto.com',
    telefono: '300-000-0000',
    sucursal: 'Sucursal Principal',
    rol: 'Vendedor Senior'
  });

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Mi Perfil</h1>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="mb-6">
          <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center text-gray-500 text-xl">
            VT
          </div>
          <h2 className="text-xl font-bold text-center">{datos.nombre}</h2>
          <p className="text-gray-500 text-center">{datos.rol}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
            <input type="text" defaultValue={datos.nombre} className="w-full border p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
            <input type="email" defaultValue={datos.email} className="w-full border p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input type="tel" defaultValue={datos.telefono} className="w-full border p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal</label>
            <input type="text" defaultValue={datos.sucursal} className="w-full border p-2 rounded" />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <button className="px-4 py-2 border rounded hover:bg-gray-50">Cancelar</button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Guardar Cambios</button>
        </div>
      </div>
    </div>
  );
};

export default PerfilVendedor;