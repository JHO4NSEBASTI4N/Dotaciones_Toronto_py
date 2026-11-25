// src/pages/admin/editar-usuario-admin.tsx
//
// editar_usuario_admin.html del proyecto Java.
// Edita los datos de contacto de una cuenta y su rol principal. Se llega desde
// el listado con el botón de editar (ruta /admin/usuarios/:id/editar).

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, ShieldCheck, UserRound } from "../../components/iconos";
import { ErrorApi, roles as apiRoles, usuarios } from "../../services/api";
import { useSesion } from "../../context/sesion-contexto";
import {
  Aviso,
  BarraListado,
  EncabezadoModulo,
  EtiquetaActivo,
} from "../../components/indicadores";
import type { Rol, UsuarioDetalle } from "../../entity";
import { FeedbackValidacion } from "../../components/feedback-validacion";
import { validarDireccion, validarTelefono } from "../../utils/validaciones";

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
  const [camposTocados, setCamposTocados] = useState<Record<string, boolean>>({});
  const [formulario, setFormulario] = useState({
    nombre: "",
    documento: "",
    telefono: "",
    direccion: "",
    id_rol: "2",
  });

  const cargarDatos = useCallback(async () => {
    const idUsuario = Number(id);
    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      navegar("/error/404", { replace: true });
      return;
    }

    setCargando(true);
    setError("");

    try {
      const [detalle, catalogo] = await Promise.all([
        usuarios.obtener(idUsuario),
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
      if (fallo instanceof ErrorApi && fallo.estado === 404) {
        navegar("/error/404", { replace: true });
        return;
      }
      setError(fallo instanceof Error ? fallo.message : "No se pudo cargar la cuenta.");
    } finally {
      setCargando(false);
    }
  }, [id, navegar]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const idRolSeleccionado = Number(formulario.id_rol);
  const errorRol = !Number.isInteger(idRolSeleccionado) ||
    !roles.some((rol) => rol.id_rol === idRolSeleccionado && rol.activo)
    ? "Selecciona un rol activo válido."
    : null;
  const erroresCampos = {
    telefono: validarTelefono(formulario.telefono),
    direccion: validarDireccion(formulario.direccion),
    rol: errorRol,
  };
  const mostrarCampo = (campo: string) => Boolean(camposTocados[campo]);

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!cuenta) return;

    const validacion = erroresCampos.telefono ?? erroresCampos.direccion;
    if (validacion) {
      setCamposTocados({ telefono: true, direccion: true, rol: true });
      setError(validacion);
      return;
    }
    if (erroresCampos.rol) {
      setCamposTocados({ telefono: true, direccion: true, rol: true });
      setError(erroresCampos.rol);
      return;
    }
    const idRol = idRolSeleccionado;

    setGuardando(true);
    setError("");

    try {
      await usuarios.actualizar(cuenta.id_usuario, {
        telefono: formulario.telefono.trim() || null,
        direccion: formulario.direccion.trim() || null,
      });

      if (idRol !== (cuenta.id_rol_fk ?? 0)) {
        await apiRoles.asignar(cuenta.id_usuario, idRol);
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

          <form onSubmit={guardar} noValidate>
            <div className="dt-formulario-contenido">
              <div className="dt-formulario-grid">
                <label>
                  Nombre completo (no se puede cambiar)
                  <input value={formulario.nombre} disabled />
                </label>

                <label>
                  Documento (no se puede cambiar)
                  <input value={formulario.documento} disabled />
                </label>

                <label>
                  Teléfono
                  <input
                    type="tel"
                    inputMode="tel"
                    maxLength={32}
                    autoComplete="tel"
                    placeholder="+57 (300) 123 4567 o +1 (415) 555-2671"
                    value={formulario.telefono}
                    onChange={(e) => {
                      setFormulario({ ...formulario, telefono: e.target.value });
                      setCamposTocados((actual) => ({ ...actual, telefono: true }));
                    }}
                    onBlur={() => setCamposTocados((actual) => ({ ...actual, telefono: true }))}
                    aria-invalid={mostrarCampo("telefono") && Boolean(erroresCampos.telefono)}
                    aria-describedby="editar-telefono-feedback"
                  />
                  <FeedbackValidacion id="editar-telefono-feedback" error={erroresCampos.telefono} mostrar={mostrarCampo("telefono")} valido="Teléfono opcional válido." />
                </label>

                <label>
                  Dirección
                  <input
                    maxLength={255}
                    autoComplete="street-address"
                    value={formulario.direccion}
                    onChange={(e) => {
                      setFormulario({ ...formulario, direccion: e.target.value });
                      setCamposTocados((actual) => ({ ...actual, direccion: true }));
                    }}
                    onBlur={() => setCamposTocados((actual) => ({ ...actual, direccion: true }))}
                    aria-invalid={mostrarCampo("direccion") && Boolean(erroresCampos.direccion)}
                    aria-describedby="editar-direccion-feedback"
                  />
                  <FeedbackValidacion id="editar-direccion-feedback" error={erroresCampos.direccion} mostrar={mostrarCampo("direccion")} valido="Dirección opcional válida." />
                </label>

                <label>
                  Correo (no se puede cambiar)
                  <input value={cuenta.correo} disabled />
                </label>

                <label>
                  Rol principal <span>*</span>
                  <select
                    required
                    value={formulario.id_rol}
                    onChange={(e) => {
                      setFormulario({ ...formulario, id_rol: e.target.value });
                      setCamposTocados((actual) => ({ ...actual, rol: true }));
                    }}
                    onBlur={() => setCamposTocados((actual) => ({ ...actual, rol: true }))}
                    aria-invalid={mostrarCampo("rol") && Boolean(erroresCampos.rol)}
                    aria-describedby="editar-rol-feedback"
                  >
                    {roles
                      .filter((rol) => rol.activo)
                      .map((rol) => (
                        <option key={rol.id_rol} value={rol.id_rol}>
                          {rol.nombre_rol}
                        </option>
                      ))}
                  </select>
                  <FeedbackValidacion id="editar-rol-feedback" error={erroresCampos.rol} mostrar={mostrarCampo("rol")} valido="Rol activo seleccionado." />
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
