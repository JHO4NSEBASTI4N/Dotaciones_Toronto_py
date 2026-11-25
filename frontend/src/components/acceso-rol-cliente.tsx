import { useState } from "react";
import { ArrowLeftRight, CheckCircle2, Store } from "./iconos";
import { Aviso } from "./indicadores";
import { ROL_CLIENTE, useSesion } from "../context/sesion-contexto";
import { auth } from "../services/api";

/** Acceso de personal al rol Cliente, sin retirar sus otros roles. */
export function AccesoRolCliente() {
  const { usuario, cambiarRol, recargar } = useSesion();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const tieneRolCliente = Boolean(
    usuario?.roles.some((rol) => rol.id_rol === ROL_CLIENTE)
  );

  const activarOEntrar = async () => {
    if (procesando) return;
    setProcesando(true);
    setError("");
    setMensaje("");

    try {
      if (tieneRolCliente) {
        await cambiarRol(ROL_CLIENTE);
        return;
      }

      await auth.activarCliente();
      const sesionActualizada = await recargar();
      setMensaje(
        sesionActualizada
          ? "Rol Cliente activado. Ya puedes cambiar a ese rol desde el menú."
          : "Rol Cliente activado; vuelve a cargar el panel para actualizar los roles disponibles."
      );
    } catch (fallo) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo activar el rol Cliente. Inténtalo de nuevo."
      );
    } finally {
      setProcesando(false);
    }
  };

  return (
    <section
      className="dt-listado"
      style={{ padding: "16px 20px", marginBottom: 16 }}
      aria-label="Acceso al rol Cliente"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div className="dt-identidad-fila">
          <span className="dt-avatar-fila" style={{ color: "#881337", background: "#fff1f2" }}>
            <Store size={18} />
          </span>
          <div>
            <strong className="dt-fila-principal">¿Quieres comprar como cliente?</strong>
            <span className="dt-fila-secundaria">
              {tieneRolCliente
                ? "Ya tienes este rol. Puedes entrar a tu espacio de compras sin cerrar sesión."
                : `Activa el rol Cliente sin perder tu rol de ${usuario?.nombre_rol ?? "personal"}.`}
            </span>
          </div>
        </div>

        <button
          type="button"
          className={tieneRolCliente ? "dt-boton-secundario" : "dt-accion-principal"}
          onClick={() => void activarOEntrar()}
          disabled={procesando}
        >
          {procesando ? (
            <span className="dt-spinner" />
          ) : tieneRolCliente ? (
            <ArrowLeftRight size={15} />
          ) : (
            <CheckCircle2 size={15} />
          )}
          {tieneRolCliente ? "Cambiar a Cliente" : "Activar rol Cliente"}
        </button>
      </div>

      {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}
      {mensaje && <Aviso tipo="exito" mensaje={mensaje} onCerrar={() => setMensaje("")} />}
    </section>
  );
}
