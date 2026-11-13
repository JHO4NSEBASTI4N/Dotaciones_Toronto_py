// src/pages/admin/editar-usuario-admin.tsx
//
// editar_usuario_admin.html del proyecto Java.
// Edita los datos de contacto de una cuenta y su rol principal. Se llega desde
// el listado con el botón de editar (ruta /admin/usuarios/:id/editar).

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, ShieldCheck, UserRound } from "../../components/iconos";
import { roles as apiRoles, usuarios } from "../../services/api";
import { useSesion } from "../../context/sesion-contexto";
import {
  Aviso,
  BarraListado,
  EncabezadoModulo,
  EtiquetaActivo,
} from "../../components/indicadores";
import type { Rol, UsuarioDetalle } from "../../entity";

export default function EditarUsuarioAdmin() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { usuario } = useSesion();

  const [cuenta, setCuenta] = useState<UsuarioDetalle | null>(null);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [formulario, setFormulario] = useState({
    nombre: "",
    documento: "",
    telefono: "",
    direccion: "",
    id_rol: "2",
  });

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const [detalle, catalogo] = await Promise.all([
        usuarios.obtener(Number(id)),
        apiRoles.listar(),
      ]);

      setCuenta(detalle);
      setRoles(catalogo);
      setFormulario({
        nombre: detalle.nombre,
        documento: detalle.documento ?? "",
        telefono: detalle.telefono ?? "",
        direccion: detalle.direccion ?? "",
        id_rol: String(detalle.id_rol_fk ?? 2),
      });
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo cargar la cuenta.");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!cuenta) return;

    setGuardando(true);
    setError("");

    try {
      await usuarios.actualizar(cuenta.id_usuario, {
        nombre: formulario.nombre,
        documento: formulario.documento || null,
        telefono: formulario.telefono || null,
        direccion: formulario.direccion || null,
      });

      if (Number(formulario.id_rol) !== (cuenta.id_rol_fk ?? 0)) {
        await apiRoles.asignar(cuenta.id_usuario, Number(formulario.id_rol));
      }

      setMensaje("Cuenta actualizada.");
      navegar("/admin/usuarios");
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="dt-tabla-vacia">
        <span className="dt-vacio-icono">
          <span className="dt-spinner" />
        </span>
        <strong>Cargando la cuenta</strong>
      </div>
    );
  }

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Administración"
        titulo={cuenta ? `Editar ${cuenta.nombre}` : "Editar usuario"}
        descripcion="Datos de contacto y rol principal de la cuenta."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "admin" } : undefined}
        accion={
          <Link to="/admin/usuarios" className="dt-boton-secundario">
            <ArrowLeft size={14} /> Volver al listado
          </Link>
        }
      />

      {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}
      {mensaje && <Aviso tipo="exito" mensaje={mensaje} />}

      {cuenta && (
        <section className="dt-listado">
          <BarraListado
            titulo="Datos de la cuenta"
            descripcion={cuenta.correo}
            Icono={UserRound}
          >
            <EtiquetaActivo
              activo={cuenta.estado === "Habilitado"}
              textoActivo="Habilitado"
              textoInactivo="Inhabilitado"
            />
          </BarraListado>

          <form onSubmit={guardar}>
            <div className="dt-formulario-contenido">
              <div className="dt-formulario-grid">
                <label>
                  Nombre completo <span>*</span>
                  <input
                    value={formulario.nombre}
                    onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })}
                    required
                  />
                </label>

                <label>
                  Documento
                  <input
                    value={formulario.documento}
                    onChange={(e) => setFormulario({ ...formulario, documento: e.target.value })}
                  />
                </label>

                <label>
                  Teléfono
                  <input
                    value={formulario.telefono}
                    onChange={(e) => setFormulario({ ...formulario, telefono: e.target.value })}
                  />
                </label>

                <label>
                  Dirección
                  <input
                    value={formulario.direccion}
                    onChange={(e) => setFormulario({ ...formulario, direccion: e.target.value })}
                  />
                </label>

                <label>
                  Correo (no se puede cambiar)
                  <input value={cuenta.correo} disabled />
                </label>

                <label>
                  Rol principal <span>*</span>
                  <select
                    value={formulario.id_rol}
                    onChange={(e) => setFormulario({ ...formulario, id_rol: e.target.value })}
                  >
                    {roles
                      .filter((rol) => rol.activo)
                      .map((rol) => (
                        <option key={rol.id_rol} value={rol.id_rol}>
                          {rol.nombre_rol}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            </div>

            <footer className="dt-modal-acciones">
              <Link to="/admin/usuarios" className="dt-boton-secundario">
                Cancelar
              </Link>
              <button type="submit" className="dt-accion-principal" disabled={guardando}>
                {guardando ? <span className="dt-spinner" /> : <Save size={15} />}
                Guardar cambios
              </button>
            </footer>
          </form>
        </section>
      )}

      <p style={{ marginTop: 12 }}>
        <span className="dt-fila-secundaria">
          <ShieldCheck size={12} /> Para darle varios roles usa el botón de roles en el listado.
        </span>
      </p>
    </section>
  );
}
