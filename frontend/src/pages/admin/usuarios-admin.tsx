// src/pages/admin/usuarios.tsx
//
// Cuentas del sistema: crear (POST /auth/registro), editar (PATCH), habilitar
// e inhabilitar (nunca se borra) y asignar roles de la tabla usuario_rol.

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { KeyRound, Mail, Pencil, Plus, RefreshCw, ShieldCheck, UserCheck, UserMinus, UserRound, Users, X } from "../../components/iconos";

import { auth, roles as apiRoles, usuarios } from "../../services/api";
import { useSesion } from "../../context/sesion-contexto";
import {
  Aviso,
  BarraListado,
  CajaBusqueda,
  EncabezadoModulo,
  EtiquetaActivo,
  FiltroEstado,
  FilaIndicadores,
  Indicador,
  TablaCargando,
  TablaVacia,
  iniciales,
} from "../../components/indicadores";
import type { Rol, UsuarioDetalle } from "../../types";

interface Formulario {
  nombre: string;
  correo: string;
  documento: string;
  telefono: string;
  direccion: string;
  password: string;
  id_rol: string;
}

const FORMULARIO_VACIO: Formulario = {
  nombre: "",
  correo: "",
  documento: "",
  telefono: "",
  direccion: "",
  password: "",
  id_rol: "2",
};

export default function UsuariosVista() {
  const { usuario } = useSesion();

  const [lista, setLista] = useState<UsuarioDetalle[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<UsuarioDetalle | null>(null);
  const [formulario, setFormulario] = useState<Formulario>(FORMULARIO_VACIO);
  const [modalRoles, setModalRoles] = useState<UsuarioDetalle | null>(null);
  const [rolesMarcados, setRolesMarcados] = useState<number[]>([]);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const [pagina, catalogo] = await Promise.all([
        usuarios.listar({ saltar: 0, limite: 100 }),
        apiRoles.listar(),
      ]);
      setLista(pagina.items);
      setRoles(catalogo);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudieron cargar los usuarios.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  /* ---------- resumen y filtrado ---------- */

  const resumen = useMemo(
    () => ({
      total: lista.length,
      habilitados: lista.filter((u) => u.estado === "Habilitado").length,
      inhabilitados: lista.filter((u) => u.estado !== "Habilitado").length,
      conVariosRoles: lista.filter((u) => (u.roles_activos?.length ?? 0) > 1).length,
    }),
    [lista]
  );

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return lista.filter((u) => {
      const coincideTexto =
        !texto ||
        u.nombre.toLowerCase().includes(texto) ||
        u.correo.toLowerCase().includes(texto) ||
        (u.documento ?? "").toLowerCase().includes(texto);

      const coincideEstado = !filtroEstado || u.estado === filtroEstado;

      return coincideTexto && coincideEstado;
    });
  }, [lista, busqueda, filtroEstado]);

  const nombreRol = (idRol: number | null) =>
    roles.find((rol) => rol.id_rol === idRol)?.nombre_rol ?? "Sin rol";

  /* ---------- acciones ---------- */

  const abrirRegistro = () => {
    setEditando(null);
    setFormulario(FORMULARIO_VACIO);
    setError("");
    setModalAbierto(true);
  };

  const abrirEdicion = (elegido: UsuarioDetalle) => {
    setEditando(elegido);
    setFormulario({
      nombre: elegido.nombre,
      correo: elegido.correo,
      documento: elegido.documento ?? "",
      telefono: elegido.telefono ?? "",
      direccion: elegido.direccion ?? "",
      password: "",
      id_rol: String(elegido.id_rol_fk ?? 2),
    });
    setError("");
    setModalAbierto(true);
  };

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    setGuardando(true);
    setError("");

    try {
      if (editando) {
        await usuarios.actualizar(editando.id_usuario, {
          nombre: formulario.nombre,
          documento: formulario.documento || null,
          telefono: formulario.telefono || null,
          direccion: formulario.direccion || null,
        });

        if (Number(formulario.id_rol) !== (editando.id_rol_fk ?? 0)) {
          await apiRoles.asignar(editando.id_usuario, Number(formulario.id_rol));
        }

        setMensaje(`Se actualizó la cuenta de ${formulario.nombre}.`);
      } else {
        const creado = await auth.registro({
          nombre: formulario.nombre,
          correo: formulario.correo,
          documento: formulario.documento || null,
          telefono: formulario.telefono || null,
          direccion: formulario.direccion || null,
          password: formulario.password,
        });

        if (Number(formulario.id_rol) !== 2) {
          await apiRoles.asignar(creado.id_usuario, Number(formulario.id_rol));
        }

        setMensaje(`Se creó la cuenta de ${formulario.nombre}.`);
      }

      setModalAbierto(false);
      await cargarDatos();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo guardar la cuenta.");
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (elegido: UsuarioDetalle) => {
    const habilitar = elegido.estado !== "Habilitado";
    const confirmado = window.confirm(
      habilitar
        ? `¿Habilitar de nuevo la cuenta de ${elegido.nombre}?`
        : `¿Inhabilitar la cuenta de ${elegido.nombre}? No se borra nada, solo deja de poder entrar.`
    );
    if (!confirmado) return;

    try {
      if (habilitar) await usuarios.habilitar(elegido.id_usuario);
      else await usuarios.inhabilitar(elegido.id_usuario);

      setMensaje(
        habilitar
          ? `${elegido.nombre} quedó habilitado.`
          : `${elegido.nombre} quedó inhabilitado.`
      );
      await cargarDatos();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo cambiar el estado.");
    }
  };

  const abrirRoles = async (elegido: UsuarioDetalle) => {
    setModalRoles(elegido);
    setRolesMarcados(elegido.roles_activos ?? []);
  };

  const alternarRol = async (idRol: number) => {
    if (!modalRoles) return;

    const tiene = rolesMarcados.includes(idRol);
    setGuardando(true);
    setError("");

    try {
      if (tiene) await apiRoles.retirar(modalRoles.id_usuario, idRol);
      else await apiRoles.asignar(modalRoles.id_usuario, idRol);

      setRolesMarcados((previos) =>
        tiene ? previos.filter((id) => id !== idRol) : [...previos, idRol]
      );
      setMensaje("Roles actualizados.");
      await cargarDatos();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo cambiar el rol.");
    } finally {
      setGuardando(false);
    }
  };

  const restablecerPassword = async (elegido: UsuarioDetalle) => {
    const nueva = window.prompt(
      `Nueva contraseña para ${elegido.nombre} (mínimo 8 caracteres):`
    );
    if (!nueva) return;

    try {
      await usuarios.restablecerPassword(elegido.id_usuario, nueva);
      setMensaje(`Contraseña de ${elegido.nombre} actualizada.`);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo cambiar la contraseña.");
    }
  };

  const cierraSiEsFondo = (evento: React.MouseEvent<HTMLDivElement>) => {
    if (evento.target === evento.currentTarget) {
      setModalAbierto(false);
      setModalRoles(null);
    }
  };

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Administración"
        titulo="Usuarios"
        descripcion="Cada persona con su cuenta, su rol y su estado. Las cuentas no se eliminan: se inhabilitan."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "admin" } : undefined}
        accion={
          <button type="button" className="dt-accion-principal" onClick={abrirRegistro}>
            <Plus size={15} />
            Nueva cuenta
          </button>
        }
      />

      {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}
      {mensaje && <Aviso tipo="exito" mensaje={mensaje} onCerrar={() => setMensaje("")} />}

      <FilaIndicadores>
        <Indicador etiqueta="Cuentas" valor={resumen.total} descripcion="Registradas en el sistema" icono={Users} tono="azul" cargando={cargando} />
        <Indicador etiqueta="Habilitadas" valor={resumen.habilitados} descripcion="Pueden iniciar sesión" icono={UserCheck} tono="verde" cargando={cargando} />
        <Indicador etiqueta="Inhabilitadas" valor={resumen.inhabilitados} descripcion="Bloqueadas sin borrar" icono={UserMinus} tono="rojo" cargando={cargando} />
        <Indicador etiqueta="Multirrol" valor={resumen.conVariosRoles} descripcion="Pueden cambiar de rol" icono={ShieldCheck} tono="morado" cargando={cargando} />
      </FilaIndicadores>

      <section className="dt-listado">
        <BarraListado
          titulo="Listado de usuarios"
          descripcion={`${filtrados.length} de ${lista.length} cuentas`}
          Icono={Users}
        >
          <CajaBusqueda valor={busqueda} onCambio={setBusqueda} marcador="Nombre, correo o documento" />

          <FiltroEstado
            valor={filtroEstado}
            onCambio={setFiltroEstado}
            opciones={[
              { valor: "", texto: "Todos los estados" },
              { valor: "Habilitado", texto: "Habilitados" },
              { valor: "Inhabilitado", texto: "Inhabilitados" },
            ]}
          />

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
          <TablaCargando mensaje="Consultando las cuentas registradas…" />
        ) : filtrados.length === 0 ? (
          <TablaVacia
            titulo="No hay cuentas que coincidan"
            mensaje="Prueba con otro texto de búsqueda o crea una cuenta nueva."
            Icono={UserRound}
            accion={
              <button type="button" className="dt-accion-principal" onClick={abrirRegistro}>
                <Plus size={15} /> Nueva cuenta
              </button>
            }
          />
        ) : (
          <div className="dt-tabla-scroll">
            <table className="dt-tabla">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol principal</th>
                  <th>Roles activos</th>
                  <th>Contacto</th>
                  <th>Estado</th>
                  <th className="dt-columna-acciones">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filtrados.map((cuenta) => (
                  <tr key={cuenta.id_usuario}>
                    <td>
                      <div className="dt-identidad-fila">
                        <span className="dt-avatar-fila">{iniciales(cuenta.nombre)}</span>
                        <div>
                          <span className="dt-fila-principal">{cuenta.nombre}</span>
                          <span className="dt-fila-secundaria">
                            {cuenta.correo} · Doc. {cuenta.documento ?? "—"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>{nombreRol(cuenta.id_rol_fk)}</td>

                    <td>
                      <span className="dt-fila-secundaria">
                        {(cuenta.roles_activos ?? []).length > 0
                          ? (cuenta.roles_activos ?? []).map(nombreRol).join(", ")
                          : "—"}
                      </span>
                    </td>

                    <td>
                      <span className="dt-fila-secundaria">
                        {cuenta.telefono ?? "Sin teléfono"}
                      </span>
                      <span className="dt-fila-secundaria">{cuenta.direccion ?? ""}</span>
                    </td>

                    <td>
                      <EtiquetaActivo
                        activo={cuenta.estado === "Habilitado"}
                        textoActivo="Habilitado"
                        textoInactivo="Inhabilitado"
                      />
                    </td>

                    <td>
                      <div className="dt-acciones-fila">
                        <button
                          type="button"
                          className="dt-boton-icono"
                          title="Editar datos"
                          onClick={() => abrirEdicion(cuenta)}
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          type="button"
                          className="dt-boton-icono"
                          title="Asignar roles"
                          onClick={() => void abrirRoles(cuenta)}
                        >
                          <ShieldCheck size={14} />
                        </button>

                        <button
                          type="button"
                          className="dt-boton-icono"
                          title="Restablecer contraseña"
                          onClick={() => void restablecerPassword(cuenta)}
                        >
                          <KeyRound size={14} />
                        </button>

                        <button
                          type="button"
                          className="dt-boton-icono dt-boton-peligro"
                          title={cuenta.estado === "Habilitado" ? "Inhabilitar" : "Habilitar"}
                          onClick={() => void cambiarEstado(cuenta)}
                        >
                          {cuenta.estado === "Habilitado" ? <UserMinus size={14} /> : <UserCheck size={14} />}
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

      {/* ---------------- Modal de registro / edición ---------------- */}
      {modalAbierto && (
        <div className="dt-modal-fondo" onMouseDown={cierraSiEsFondo}>
          <section className="dt-modal" role="dialog" aria-modal="true">
            <header className="dt-modal-encabezado">
              <span className="dt-modal-icono">
                <UserRound size={21} />
              </span>

              <div className="dt-modal-titulo-grupo">
                <span className="dt-migas">{editando ? "Editar" : "Nueva cuenta"}</span>
                <h2>{editando ? editando.nombre : "Registrar usuario"}</h2>
                <p>
                  {editando
                    ? "Cambia los datos de contacto y el rol principal."
                    : "La contraseña se entrega a la persona; puede cambiarla después."}
                </p>
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
                <div className="dt-formulario-seccion-titulo">
                  <span>1</span>
                  <div>
                    <strong>Datos personales</strong>
                    <p>Como aparecerán en pedidos y facturas</p>
                  </div>
                </div>

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
                </div>

                <div className="dt-formulario-seccion-titulo" style={{ marginTop: 20 }}>
                  <span>2</span>
                  <div>
                    <strong>Acceso al sistema</strong>
                    <p>Correo, contraseña y rol principal</p>
                  </div>
                </div>

                <div className="dt-formulario-grid">
                  <label>
                    Correo electrónico <span>*</span>
                    <input
                      type="email"
                      value={formulario.correo}
                      onChange={(e) => setFormulario({ ...formulario, correo: e.target.value })}
                      disabled={Boolean(editando)}
                      required
                    />
                  </label>

                  {!editando && (
                    <label>
                      Contraseña inicial <span>*</span>
                      <input
                        type="password"
                        minLength={8}
                        value={formulario.password}
                        onChange={(e) => setFormulario({ ...formulario, password: e.target.value })}
                        required
                      />
                    </label>
                  )}

                  <label className={editando ? "" : "dt-campo-ancho"}>
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
                <button
                  type="button"
                  className="dt-boton-secundario"
                  onClick={() => setModalAbierto(false)}
                  disabled={guardando}
                >
                  Cancelar
                </button>

                <button type="submit" className="dt-accion-principal" disabled={guardando}>
                  {guardando ? <span className="dt-spinner" /> : <Mail size={15} />}
                  {editando ? "Guardar cambios" : "Crear cuenta"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {/* ---------------- Modal de roles ---------------- */}
      {modalRoles && (
        <div className="dt-modal-fondo" onMouseDown={cierraSiEsFondo}>
          <section className="dt-modal" style={{ maxWidth: 520 }} role="dialog" aria-modal="true">
            <header className="dt-modal-encabezado">
              <span className="dt-modal-icono">
                <ShieldCheck size={21} />
              </span>

              <div className="dt-modal-titulo-grupo">
                <span className="dt-migas">Multirrol</span>
                <h2>Roles de {modalRoles.nombre}</h2>
                <p>Marca todos los roles con los que esta persona podrá entrar.</p>
              </div>

              <button
                type="button"
                className="dt-boton-cerrar-modal"
                onClick={() => setModalRoles(null)}
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </header>

            <div className="dt-formulario-contenido">
              <div className="dt-formulario-grid" style={{ gridTemplateColumns: "1fr" }}>
                {roles.map((rol) => (
                  <label
                    key={rol.id_rol}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                  >
                    <input
                      type="checkbox"
                      style={{ width: 16 }}
                      checked={rolesMarcados.includes(rol.id_rol)}
                      disabled={guardando || !rol.activo}
                      onChange={() => void alternarRol(rol.id_rol)}
                    />
                    {rol.nombre_rol}
                    <span className="dt-fila-secundaria" style={{ marginLeft: "auto" }}>
                      {rol.descripcion_rol ?? ""}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <footer className="dt-modal-acciones">
              <button
                type="button"
                className="dt-boton-secundario"
                onClick={() => setModalRoles(null)}
              >
                Listo
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
