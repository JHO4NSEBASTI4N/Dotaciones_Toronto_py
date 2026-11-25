// src/components/perfil-cuenta.tsx
//
// Formulario de "mi perfil" compartido: lo usan las cuatro pantallas
// perfil-admin, perfil-vendedor, perfil-bodeguero y perfil-cliente
// (que en el proyecto Java eran cuatro plantillas casi iguales).

import { useEffect, useState, type FormEvent } from "react";
import {
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from "../components/iconos";
import { auth, usuarios } from "../services/api";
import { FeedbackValidacion } from "./feedback-validacion";
import { useCamposTocados } from "../hooks/use-campos-tocados";
import {
  validarDireccion,
  validarPasswordSegura,
  validarTelefono,
} from "../utils/validaciones";
import { NOMBRE_ROL, CLASE_ROL, useSesion } from "../context/sesion-contexto";
import {
  Aviso,
  BarraListado,
  EncabezadoModulo,
  EtiquetaEstado,
  FilaIndicadores,
  Indicador,
} from "./indicadores";

export default function PerfilCuenta({ seccion }: { seccion: string }) {
  const { usuario, recargar, cambiarRol } = useSesion();

  const [formulario, setFormulario] = useState({
    nombre: "",
    documento: "",
    telefono: "",
    direccion: "",
  });

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirmar, setPasswordConfirmar] = useState("");
  const [cambiando, setCambiando] = useState(false);
  const { tocar, tocarVarios, mostrar, reiniciar } = useCamposTocados();
  const errorConfirmacion = !passwordConfirmar
    ? "Confirma la nueva contraseña."
    : passwordNueva !== passwordConfirmar
      ? "La confirmación no coincide con la nueva contraseña."
      : null;
  const erroresCampos = {
    telefono: validarTelefono(formulario.telefono),
    direccion: validarDireccion(formulario.direccion),
    passwordActual: passwordActual ? null : "Escribe la contraseña actual.",
    passwordNueva: validarPasswordSegura(passwordNueva) ??
      (passwordNueva === passwordActual ? "La nueva contraseña debe ser distinta de la actual." : null),
    passwordConfirmar: errorConfirmacion,
  };

  useEffect(() => {
    if (!usuario) return;

    setFormulario({
      nombre: usuario.nombre,
      documento: usuario.documento ?? "",
      telefono: usuario.telefono ?? "",
      direccion: usuario.direccion ?? "",
    });
  }, [usuario]);

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!usuario) return;

    const validacion = erroresCampos.telefono ?? erroresCampos.direccion;
    if (validacion) {
      tocarVarios(["telefono", "direccion"]);
      setError(validacion);
      return;
    }

    setGuardando(true);
    setError("");

    try {
      await usuarios.actualizar(usuario.id_usuario, {
        telefono: formulario.telefono.trim() || null,
        direccion: formulario.direccion.trim() || null,
      });

      await recargar();
      setMensaje("Tus datos quedaron actualizados.");
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudieron guardar tus datos.");
    } finally {
      setGuardando(false);
    }
  };

  const cambiarPassword = async (evento: FormEvent) => {
    evento.preventDefault();
    const errorPassword = erroresCampos.passwordActual ?? erroresCampos.passwordNueva ?? erroresCampos.passwordConfirmar;
    if (errorPassword) {
      tocarVarios(["passwordActual", "passwordNueva", "passwordConfirmar"]);
      setError(errorPassword);
      return;
    }
    setCambiando(true);
    setError("");

    try {
      await auth.cambiarPassword(passwordActual, passwordNueva);
      setMensaje("Contraseña actualizada.");
      setPasswordActual("");
      setPasswordNueva("");
      setPasswordConfirmar("");
      reiniciar();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo cambiar la contraseña.");
    } finally {
      setCambiando(false);
    }
  };

  if (!usuario) return null;

  const clase = ["admin", "cliente", "vendedor", "bodeguero"][
    [1, 2, 3, 4].indexOf(usuario.id_rol)
  ] ?? "cliente";

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion={seccion}
        titulo="Mi perfil"
        descripcion="Tus datos de contacto y tu seguridad. Los usa la empresa para facturar y entregar."
        rol={{ nombre: usuario.nombre_rol, clase }}
      />

      {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}
      {mensaje && <Aviso tipo="exito" mensaje={mensaje} onCerrar={() => setMensaje("")} />}

      <FilaIndicadores>
        <Indicador
          etiqueta="Cuenta"
          valor={`#${usuario.id_usuario}`}
          descripcion={usuario.correo}
          icono={UserRound}
          tono="azul"
        />
        <Indicador
          etiqueta="Rol activo"
          valor={usuario.nombre_rol}
          descripcion="Con el que estás dentro"
          icono={ShieldCheck}
          tono="verde"
        />
        <Indicador
          etiqueta="Roles"
          valor={usuario.roles.length}
          descripcion="Puedes cambiar de rol"
          icono={ShieldCheck}
          tono="morado"
        />
        <Indicador
          etiqueta="Estado"
          valor={usuario.activo ? "Habilitada" : "Inhabilitada"}
          descripcion="Definido por la empresa"
          icono={UserRound}
          tono={usuario.activo ? "verde" : "rojo"}
        />
      </FilaIndicadores>

      <div className="dt-grid-dashboard">
        <section className="dt-listado">
          <BarraListado
            titulo="Datos de contacto"
            descripcion="Se usan en pedidos y facturas"
            Icono={UserRound}
          >
            <EtiquetaEstado tipo="neutro" texto={usuario.correo} />
          </BarraListado>

          <form onSubmit={guardar} noValidate>
            <div className="dt-formulario-contenido">
              <div className="dt-formulario-grid">
                <label className="dt-campo-ancho">
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
                    onChange={(e) => { setFormulario({ ...formulario, telefono: e.target.value }); tocar("telefono"); }}
                    onBlur={() => tocar("telefono")}
                    aria-invalid={mostrar("telefono") && Boolean(erroresCampos.telefono)}
                    aria-describedby="perfil-telefono-feedback"
                  />
                  <FeedbackValidacion id="perfil-telefono-feedback" error={erroresCampos.telefono} mostrar={mostrar("telefono")} valido="Teléfono opcional válido." />
                </label>

                <label className="dt-campo-ancho">
                  Dirección
                  <input
                    maxLength={255}
                    autoComplete="street-address"
                    value={formulario.direccion}
                    onChange={(e) => { setFormulario({ ...formulario, direccion: e.target.value }); tocar("direccion"); }}
                    onBlur={() => tocar("direccion")}
                    aria-invalid={mostrar("direccion") && Boolean(erroresCampos.direccion)}
                    aria-describedby="perfil-direccion-feedback"
                  />
                  <FeedbackValidacion id="perfil-direccion-feedback" error={erroresCampos.direccion} mostrar={mostrar("direccion")} valido="Dirección opcional válida." />
                </label>

                <label className="dt-campo-ancho">
                  Correo (no se puede cambiar)
                  <input value={usuario.correo} disabled />
                </label>
              </div>

              <p style={{ marginTop: 12, display: "flex", gap: 14, flexWrap: "wrap" }}>
                <span className="dt-fila-secundaria">
                  <Mail size={12} /> {usuario.correo}
                </span>
                <span className="dt-fila-secundaria">
                  <Phone size={12} /> {usuario.telefono ?? "Sin teléfono"}
                </span>
                <span className="dt-fila-secundaria">
                  <MapPin size={12} /> {usuario.direccion ?? "Sin dirección"}
                </span>
              </p>
            </div>

            <footer className="dt-modal-acciones">
              <button type="submit" className="dt-accion-principal" disabled={guardando}>
                {guardando ? <span className="dt-spinner" /> : <Save size={15} />}
                Guardar cambios
              </button>
            </footer>
          </form>
        </section>

        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <section className="dt-listado">
            <BarraListado
              titulo="Contraseña"
              descripcion="8+ caracteres, una letra, un número y un símbolo"
              Icono={KeyRound}
            />

            <form onSubmit={cambiarPassword} noValidate>
              <div className="dt-formulario-contenido">
                <div className="dt-formulario-grid" style={{ gridTemplateColumns: "1fr" }}>
                  <label>
                    Contraseña actual <span>*</span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      maxLength={72}
                      value={passwordActual}
                      onChange={(e) => { setPasswordActual(e.target.value); tocar("passwordActual"); }}
                      onBlur={() => tocar("passwordActual")}
                      aria-invalid={mostrar("passwordActual") && Boolean(erroresCampos.passwordActual)}
                      aria-describedby="perfil-password-actual-feedback"
                      required
                    />
                    <FeedbackValidacion id="perfil-password-actual-feedback" error={erroresCampos.passwordActual} mostrar={mostrar("passwordActual")} />
                  </label>

                  <label>
                    Contraseña nueva <span>*</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={72}
                      value={passwordNueva}
                      onChange={(e) => { setPasswordNueva(e.target.value); tocar("passwordNueva"); }}
                      onBlur={() => tocar("passwordNueva")}
                      aria-invalid={mostrar("passwordNueva") && Boolean(erroresCampos.passwordNueva)}
                      aria-describedby="perfil-password-nueva-feedback"
                      required
                    />
                    <FeedbackValidacion id="perfil-password-nueva-feedback" error={erroresCampos.passwordNueva} mostrar={mostrar("passwordNueva")} valido="Cumple la política de contraseña." />
                  </label>
                  <label>
                    Confirmar contraseña nueva <span>*</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={72}
                      value={passwordConfirmar}
                      onChange={(e) => { setPasswordConfirmar(e.target.value); tocar("passwordConfirmar"); }}
                      onBlur={() => tocar("passwordConfirmar")}
                      aria-invalid={mostrar("passwordConfirmar") && Boolean(erroresCampos.passwordConfirmar)}
                      aria-describedby="perfil-password-confirmar-feedback"
                      required
                    />
                    <FeedbackValidacion id="perfil-password-confirmar-feedback" error={erroresCampos.passwordConfirmar} mostrar={mostrar("passwordConfirmar")} />
                  </label>
                </div>
              </div>

              <footer className="dt-modal-acciones">
                <button type="submit" className="dt-boton-secundario" disabled={cambiando}>
                  {cambiando ? <span className="dt-spinner" /> : <KeyRound size={14} />}
                  Cambiar contraseña
                </button>
              </footer>
            </form>
          </section>

          {usuario.roles.length > 1 && (
            <section className="dt-listado">
              <BarraListado
                titulo="Cambiar de rol"
                descripcion="Tu cuenta tiene varios roles"
                Icono={ShieldCheck}
              />

              <div className="dt-formulario-contenido">
                <div className="dt-formulario-grid" style={{ gridTemplateColumns: "1fr" }}>
                  {usuario.roles.map((rol) => (
                    <button
                      key={rol.id_rol}
                      type="button"
                      className={`dt-boton-rol dt-boton-rol-${
                        CLASE_ROL[rol.id_rol] ?? "cliente"
                      }`}
                      disabled={rol.id_rol === usuario.id_rol}
                      onClick={() => void cambiarRol(rol.id_rol)}
                    >
                      <span className="dt-boton-rol-punto" />
                      <ShieldCheck size={14} />
                      {NOMBRE_ROL[rol.id_rol] ?? rol.nombre_rol}
                      {rol.id_rol === usuario.id_rol && " · actual"}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
