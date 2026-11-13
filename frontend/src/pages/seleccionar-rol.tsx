// src/pages/seleccionar-rol.tsx
//
// seleccionar-rol.html del proyecto Java.
// Cuando la cuenta tiene varios roles, aquí se elige con cuál trabajar.
// El backend devuelve un token nuevo con el rol elegido.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  LogOut,
  Package,
  ShieldCheck,
  UserRound,
} from "../components/iconos";
import { ErrorApi } from "../services/api";
import { autenticacion, NOMBRE_ROL, RUTA_POR_ROL } from "../services/autenticacion";
import { useSesion } from "../context/sesion-contexto";
import { Aviso } from "../components/indicadores";
import type { RolDisponible } from "../entity";

const ICONOS: Record<number, typeof ShieldCheck> = {
  1: ShieldCheck,
  2: UserRound,
  3: BadgeCheck,
  4: Boxes,
};

const DETALLE: Record<number, string> = {
  1: "Administras usuarios, roles, productos y todo el sistema.",
  2: "Compras dotaciones y sigues tus pedidos.",
  3: "Gestionas pedidos, ventas y devoluciones.",
  4: "Controlas el inventario y las alertas de stock.",
};

export default function SeleccionarRol() {
  const navegar = useNavigate();
  const { usuario, recargar, salir } = useSesion();

  const [roles, setRoles] = useState<RolDisponible[]>([]);
  const [cargando, setCargando] = useState(true);
  const [entrando, setEntrando] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;

    autenticacion
      .misRoles()
      .then((lista) => {
        if (vivo) setRoles(lista);
      })
      .catch(() => {
        if (vivo) setError("No se pudieron consultar tus roles.");
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });

    return () => {
      vivo = false;
    };
  }, []);

  const entrarCon = async (idRol: number) => {
    setEntrando(idRol);
    setError("");

    try {
      await autenticacion.cambiarRol(idRol);
      await recargar();
      navegar(RUTA_POR_ROL[idRol] ?? "/login", { replace: true });
    } catch (fallo) {
      // 409 = ya estabamos operando con ese rol; el token actual ya sirve.
      if (fallo instanceof ErrorApi && fallo.estado === 409) {
        await recargar();
        navegar(RUTA_POR_ROL[idRol] ?? "/login", { replace: true });
        return;
      }
      setError(
        fallo instanceof ErrorApi
          ? `No se pudo entrar con ese rol: ${fallo.message}.`
          : "No se pudo entrar con ese rol. Revisa que el backend esté encendido."
      );
      setEntrando(null);
    }
  };

  return (
    <div className="seleccion-rol-pagina">
      <div className="seleccion-rol-tarjeta">
        <header className="seleccion-rol-encabezado">
          <div className="marca marca-oscura">
            <span className="marca-icono-solido">
              <Package size={19} />
            </span>
            Dotaciones <span className="marca-verde">Toronto</span>
          </div>

          <h1>¿Con qué rol entras?</h1>
          <p>
            {usuario ? `Hola, ${usuario.nombre}. ` : ""}
            Tu cuenta tiene varios roles. Elige uno para esta sesión; puedes
            cambiarlo después desde el menú.
          </p>
        </header>

        {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}

        {cargando ? (
          <div className="seleccion-rol-cargando">
            <span className="dt-spinner dt-spinner-grande" />
            <span>Consultando tus roles…</span>
          </div>
        ) : (
          <div className="seleccion-rol-opciones">
            {roles.map((rol) => {
              const Icono = ICONOS[rol.id_rol] ?? BadgeCheck;

              return (
                <button
                  key={rol.id_rol}
                  type="button"
                  className={`seleccion-rol-opcion seleccion-rol-${rol.id_rol}`}
                  disabled={entrando !== null}
                  onClick={() => void entrarCon(rol.id_rol)}
                >
                  <span className="seleccion-rol-icono">
                    <Icono size={20} />
                  </span>

                  <span className="seleccion-rol-texto">
                    <strong>{NOMBRE_ROL[rol.id_rol] ?? rol.nombre_rol}</strong>
                    <span>{DETALLE[rol.id_rol] ?? rol.descripcion_rol ?? ""}</span>
                  </span>

                  {entrando === rol.id_rol ? (
                    <span className="dt-spinner" />
                  ) : (
                    <ArrowRight size={16} />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <footer className="seleccion-rol-pie">
          <button type="button" className="dt-boton-secundario" onClick={salir}>
            <LogOut size={13} /> Cerrar sesión
          </button>
        </footer>
      </div>
    </div>
  );
}
