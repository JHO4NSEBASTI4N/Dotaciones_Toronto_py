// src/pages/Clientes.tsx

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { clientes } from "../services/api";
import type { Usuario } from "../types";

function Clientes() {
  const [lista, setLista] = useState<Usuario[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    clientes
      .listar()
      .then(setLista)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "No se pudieron cargar los clientes")
      )
      .finally(() => setCargando(false));
  }, []);

  const filtrados = lista.filter((c) => {
    const texto = busqueda.toLowerCase();
    return (
      c.nombre.toLowerCase().includes(texto) ||
      c.correo.toLowerCase().includes(texto) ||
      (c.documento ?? "").includes(texto)
    );
  });

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="mb-0">Clientes</h3>
        <Link to="/dashboard" className="btn btn-outline-secondary btn-sm">
          <i className="bi bi-arrow-left me-1"></i> Volver
        </Link>
      </div>

      <input
        type="text"
        className="form-control mb-3"
        placeholder="Buscar por nombre, correo o documento"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {cargando && <p>Cargando...</p>}

      {error && (
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-circle me-1"></i> {error}
        </div>
      )}

      {!cargando && !error && (
        <div className="table-responsive">
          <table className="table table-striped table-hover align-middle">
            <thead className="table-dark">
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Documento</th>
                <th>Correo</th>
                <th>Teléfono</th>
                <th>Dirección</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-secondary">
                    No hay clientes para mostrar
                  </td>
                </tr>
              ) : (
                filtrados.map((c) => (
                  <tr key={c.id_usuario}>
                    <td>{c.id_usuario}</td>
                    <td>{c.nombre}</td>
                    <td>{c.documento}</td>
                    <td>{c.correo}</td>
                    <td>{c.telefono}</td>
                    <td>{c.direccion}</td>
                    <td>
                      <span
                        className={`badge ${
                          c.estado === "Habilitado" ? "bg-success" : "bg-secondary"
                        }`}
                      >
                        {c.estado}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Clientes;