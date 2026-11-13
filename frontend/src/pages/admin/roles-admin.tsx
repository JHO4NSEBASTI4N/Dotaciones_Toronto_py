// src/pages/admin/roles.tsx
//
// Catálogo de roles. Un rol no se borra: se desactiva.

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Lock, Pencil, Plus, RefreshCw, ShieldCheck, ShieldHalf, ToggleLeft, ToggleRight, X } from "../../components/iconos";

import { roles as apiRoles } from "../../services/api";
import { useSesion } from "../../context/sesion-contexto";
import {
  Aviso,
  BarraListado,
  CajaBusqueda,
  EncabezadoModulo,
  EtiquetaActivo,
  FilaIndicadores,
  Indicador,
  TablaCargando,
  TablaVacia,
} from "../../components/indicadores";
import type { Rol } from "../../types";

export default function RolesVista() {
  const { usuario } = useSesion();

  const [lista, setLista] = useState<Rol[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Rol | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      setLista(await apiRoles.listar());
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudieron cargar los roles.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const resumen = useMemo(
    () => ({
      total: lista.length,
      activos: lista.filter((rol) => rol.activo).length,
      inactivos: lista.filter((rol) => !rol.activo).length,
    }),
    [lista]
  );

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return lista;

    return lista.filter(
      (rol) =>
        (rol.nombre_rol ?? "").toLowerCase().includes(texto) ||
        (rol.descripcion_rol ?? "").toLowerCase().includes(texto)
    );
  }, [lista, busqueda]);

  const abrirNuevo = () => {
    setEditando(null);
    setNombre("");
    setDescripcion("");
    setError("");
    setModalAbierto(true);
  };

  const abrirEdicion = (rol: Rol) => {
    setEditando(rol);
    setNombre(rol.nombre_rol ?? "");
    setDescripcion(rol.descripcion_rol ?? "");
    setError("");
    setModalAbierto(true);
  };

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    setGuardando(true);
    setError("");

    try {
      if (editando) {
        await apiRoles.actualizar(editando.id_rol, {
          nombre_rol: nombre,
          descripcion_rol: descripcion || null,
        });
        setMensaje(`Rol ${nombre} actualizado.`);
      } else {
        await apiRoles.crear({
          nombre_rol: nombre,
          descripcion_rol: descripcion || null,
        });
        setMensaje(`Rol ${nombre} creado.`);
      }

      setModalAbierto(false);
      await cargarDatos();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo guardar el rol.");
    } finally {
      setGuardando(false);
    }
  };

  const alternarActivo = async (rol: Rol) => {
    const confirmado = window.confirm(
      rol.activo
        ? `¿Desactivar el rol ${rol.nombre_rol}? Los usuarios que lo tengan dejarán de poder entrar con él.`
        : `¿Activar de nuevo el rol ${rol.nombre_rol}?`
    );
    if (!confirmado) return;

    try {
      if (rol.activo) await apiRoles.desactivar(rol.id_rol);
      else await apiRoles.activar(rol.id_rol);

      setMensaje(rol.activo ? "Rol desactivado." : "Rol activado.");
      await cargarDatos();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo cambiar el estado.");
    }
  };

  const cierraSiEsFondo = (evento: React.MouseEvent<HTMLDivElement>) => {
    if (evento.target === evento.currentTarget) setModalAbierto(false);
  };

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Administración"
        titulo="Roles y permisos"
        descripcion="Los cuatro roles base del sistema. Un usuario puede tener varios y elegir con cuál entrar."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "admin" } : undefined}
        accion={
          <button type="button" className="dt-accion-principal" onClick={abrirNuevo}>
            <Plus size={15} />
            Nuevo rol
          </button>
        }
      />

      {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}
      {mensaje && <Aviso tipo="exito" mensaje={mensaje} onCerrar={() => setMensaje("")} />}

      <FilaIndicadores>
        <Indicador etiqueta="Roles" valor={resumen.total} descripcion="Definidos en el sistema" icono={ShieldCheck} tono="azul" cargando={cargando} />
        <Indicador etiqueta="Activos" valor={resumen.activos} descripcion="Disponibles para asignar" icono={ShieldHalf} tono="verde" cargando={cargando} />
        <Indicador etiqueta="Desactivados" valor={resumen.inactivos} descripcion="Conservados, sin uso" icono={Lock} tono="rojo" cargando={cargando} />
      </FilaIndicadores>

      <section className="dt-listado">
        <BarraListado
          titulo="Roles del sistema"
          descripcion="1 Administrador · 2 Cliente · 3 Vendedor · 4 Bodeguero"
          Icono={ShieldCheck}
        >
          <CajaBusqueda valor={busqueda} onCambio={setBusqueda} marcador="Buscar rol" />

          <button
            type="button"
            className="dt-boton-icono"
            onClick={() => void cargarDatos()}
            disabled={cargando}
            title="Refrescar"
          >
            <RefreshCw size={15} className={cargando ? "dt-girando" : ""} />
          </button>
        </BarraListado>

        {cargando ? (
          <TablaCargando mensaje="Consultando los roles…" />
        ) : filtrados.length === 0 ? (
          <TablaVacia
            titulo="Sin roles"
            mensaje="No hay roles que coincidan con la búsqueda."
            Icono={ShieldCheck}
          />
        ) : (
          <div className="dt-tabla-scroll">
            <table className="dt-tabla">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Rol</th>
                  <th>Descripción</th>
                  <th>Estado</th>
                  <th className="dt-columna-acciones">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filtrados.map((rol) => (
                  <tr key={rol.id_rol}>
                    <td>
                      <span className="dt-avatar-fila">{rol.id_rol}</span>
                    </td>

                    <td>
                      <span className="dt-fila-principal">{rol.nombre_rol}</span>
                    </td>

                    <td>
                      <span className="dt-fila-secundaria">
                        {rol.descripcion_rol ?? "Sin descripción"}
                      </span>
                    </td>

                    <td>
                      <EtiquetaActivo activo={rol.activo} />
                    </td>

                    <td>
                      <div className="dt-acciones-fila">
                        <button
                          type="button"
                          className="dt-boton-icono"
                          title="Editar"
                          onClick={() => abrirEdicion(rol)}
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          type="button"
                          className="dt-boton-icono dt-boton-peligro"
                          title={rol.activo ? "Desactivar" : "Activar"}
                          onClick={() => void alternarActivo(rol)}
                        >
                          {rol.activo ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalAbierto && (
        <div className="dt-modal-fondo" onMouseDown={cierraSiEsFondo}>
          <section className="dt-modal" style={{ maxWidth: 520 }} role="dialog" aria-modal="true">
            <header className="dt-modal-encabezado">
              <span className="dt-modal-icono">
                <ShieldCheck size={21} />
              </span>

              <div className="dt-modal-titulo-grupo">
                <span className="dt-migas">{editando ? "Editar rol" : "Nuevo rol"}</span>
                <h2>{editando ? editando.nombre_rol : "Crear rol"}</h2>
                <p>El nombre debe quedar en singular, por ejemplo «Supervisor».</p>
              </div>

              <button
                type="button"
                className="dt-boton-cerrar-modal"
                onClick={() => setModalAbierto(false)}
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </header>

            <form onSubmit={guardar}>
              <div className="dt-formulario-contenido">
                <div className="dt-formulario-grid" style={{ gridTemplateColumns: "1fr" }}>
                  <label>
                    Nombre del rol <span>*</span>
                    <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                  </label>

                  <label>
                    Descripción
                    <input
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      placeholder="Qué puede hacer este rol"
                    />
                  </label>
                </div>
              </div>

              <footer className="dt-modal-acciones">
                <button
                  type="button"
                  className="dt-boton-secundario"
                  onClick={() => setModalAbierto(false)}
                  disabled={guardando}
                >
                  Cancelar
                </button>

                <button type="submit" className="dt-accion-principal" disabled={guardando}>
                  {guardando ? <span className="dt-spinner" /> : <ShieldCheck size={15} />}
                  {editando ? "Guardar cambios" : "Crear rol"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
