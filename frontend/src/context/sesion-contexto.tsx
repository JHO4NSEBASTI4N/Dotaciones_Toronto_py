// src/context/sesion-contexto.tsx
//
// Un solo lugar donde vive la sesión: quién entró, con cuál rol y qué módulos
// puede ver. Las vistas y el menú solo preguntan aquí; nunca leen el
// localStorage por su cuenta.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useLocation, useNavigate } from "react-router-dom";

import { auth, ErrorApi } from "../services/api";
import { autenticacion, RUTA_POR_ROL } from "../services/autenticacion";
import type { RolDisponible, UsuarioDetalle } from "../types";

export const ROL_ADMIN = 1;
export const ROL_CLIENTE = 2;
export const ROL_VENDEDOR = 3;
export const ROL_BODEGUERO = 4;

export const NOMBRE_ROL: Record<number, string> = {
  1: "Administrador",
  2: "Cliente",
  3: "Vendedor",
  4: "Bodeguero",
};

/** Clase de color de cada rol, para el sidebar y el banner. */
export const CLASE_ROL: Record<number, string> = {
  1: "admin",
  2: "cliente",
  3: "vendedor",
  4: "bodeguero",
};

/** Qué módulos abre cada rol. Es la misma lista que usa el menú. */
export const MODULOS_POR_ROL: Record<number, string[]> = {
  1: [
    "dashboard", "usuarios", "roles", "productos", "promociones", "pedidos", "ventas",
    "devoluciones", "inventario", "alertas", "facturacion", "perfil",
  ],
  2: ["dashboard", "catalogo", "carrito", "mis-pedidos", "devoluciones", "perfil"],
  3: ["dashboard", "pedidos", "ventas", "reportes", "devoluciones", "perfil"],
  4: ["dashboard", "inventario", "alertas", "perfil"],
};

/** Datos de sesión que se muestran en pantalla. */
export interface UsuarioSesion {
  id_usuario: number;
  nombre: string;
  correo: string;
  documento?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  activo: boolean;
  id_rol: number;
  nombre_rol: string;
  roles: RolDisponible[];
}

interface ValorSesion {
  usuario: UsuarioSesion | null;
  cargando: boolean;
  cambioRolEnCurso: boolean;
  cierreSesionEnCurso: boolean;
  error: string;
  esAdministrador: boolean;
  rolActivo: number;
  puedeVer: (modulo: string) => boolean;
  recargar: () => Promise<boolean>;
  establecerSesion: () => Promise<void>;
  cambiarRol: (idRol: number) => Promise<void>;
  salir: () => void;
}

const ContextoSesion = createContext<ValorSesion | null>(null);

function esRutaDePanel(ruta: string): boolean {
  return /^\/(admin|cliente|vendedor|bodeguero|seleccionar-rol)(\/|$)/.test(
    ruta
  );
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const navegar = useNavigate();
  const ubicacion = useLocation();

  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [rutaRolPendiente, setRutaRolPendiente] = useState<string | null>(null);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [error, setError] = useState("");

  // La guarda ve primero el estado de transición y muestra carga. Solo
  // después navegamos a la ruta destino; al llegar, liberamos la guarda.
  // Así nunca se compara la ruta vieja con el rol recién actualizado.
  useEffect(() => {
    if (!rutaRolPendiente) return;

    if (ubicacion.pathname !== rutaRolPendiente) {
      navegar(rutaRolPendiente, { replace: true });
      return;
    }

    setRutaRolPendiente(null);
  }, [rutaRolPendiente, ubicacion.pathname, navegar]);

  // Libera la marca de cierre voluntario al llegar a /login para no mostrar
  // el aviso de "Acceso denegado" cuando el propio usuario cerró su sesión.
  useEffect(() => {
    if (cerrandoSesion && ubicacion.pathname === "/login") {
      setCerrandoSesion(false);
    }
  }, [cerrandoSesion, ubicacion.pathname]);

  /** Pide /auth/yo + /auth/mis-roles y arma el objeto de sesión. */
  const cargar = useCallback(async (): Promise<boolean> => {
    if (!autenticacion.estaAutenticado()) {
      setUsuario(null);
      setCargando(false);
      return true;
    }

    setCargando(true);
    setError("");

    // Solo redirigimos automáticamente a /error/* si estamos validando una
    // ruta protegida del panel; así entrar a /, /login o a una ruta 404 con
    // el backend apagado no sobreescribe la pantalla actual.
    const rutaActual =
      typeof window !== "undefined" ? window.location.pathname : "/";
    const redirigirEnError = esRutaDePanel(rutaActual);

    try {
      const [detalle, roles] = await Promise.all([
        auth.yo({ redirigirEnError }) as Promise<
          UsuarioDetalle & { id_rol_fk?: number }
        >,
        autenticacion.misRoles({ redirigirEnError }),
      ]);

      const rolGuardado = autenticacion.rolActual();
      const idRol = rolGuardado?.id_rol || detalle.id_rol_fk || ROL_CLIENTE;

      setUsuario({
        id_usuario: detalle.id_usuario,
        nombre: detalle.nombre,
        correo: detalle.correo,
        documento: detalle.documento,
        telefono: detalle.telefono,
        direccion: detalle.direccion,
        activo: detalle.estado === "Habilitado",
        id_rol: idRol,
        nombre_rol:
          rolGuardado?.nombre_rol ?? NOMBRE_ROL[idRol] ?? "Sin rol",
        roles,
      });
      return true;
    } catch (fallo) {
      const falloServidorORed =
        !(fallo instanceof ErrorApi) ||
        fallo.estado === 0 ||
        fallo.estado >= 500;

      if (falloServidorORed) {
        // Conservamos el token para que al volver a encender el servidor el
        // botón "Reintentar" recupere la sesión sin obligar a iniciar sesión.
        setUsuario(null);
        setError("No se pudo conectar con el servidor.");
        return false;
      }

      autenticacion.logout();
      setUsuario(null);
      setError("Tu sesión expiró. Inicia sesión nuevamente.");
      return true;
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /**
   * Se llama justo después del login: el token ya está guardado, solo hay
   * que leer los datos del usuario. Sin esto el contexto se queda vacío y las
   * rutas protegidas devuelven al login.
   */
  const establecerSesion = useCallback(async () => {
    await cargar();
  }, [cargar]);

  /** Cambia el token y actualiza la sesión antes de ir al panel del nuevo rol. */
  const cambiarRol = useCallback(
    async (idRol: number) => {
      const respuesta = await autenticacion.cambiarRol(idRol);
      const idRolActivo = respuesta.id_rol ?? idRol;
      const nombreRol =
        respuesta.nombre_rol ?? NOMBRE_ROL[idRolActivo] ?? "Sin rol";

      // Bloquear las guardas mientras cambian juntos el rol y la ruta. Sin
      // esta marca, una renderización intermedia puede comparar el rol nuevo
      // con la ruta anterior y enviar por error a /error/403.
      const destino = RUTA_POR_ROL[idRolActivo] ?? "/login";
      setRutaRolPendiente(destino);
      setUsuario((actual) =>
        actual
          ? { ...actual, id_rol: idRolActivo, nombre_rol: nombreRol }
          : actual
      );
    },
    []
  );

  const salir = useCallback(() => {
    setCerrandoSesion(true);
    autenticacion.logout();
    setUsuario(null);
    navegar("/login", { replace: true });
  }, [navegar]);

  const valor = useMemo<ValorSesion>(() => {
    const rolActivo = usuario?.id_rol ?? 0;

    return {
      usuario,
      cargando,
      cambioRolEnCurso: rutaRolPendiente !== null,
      cierreSesionEnCurso: cerrandoSesion,
      error,
      rolActivo,
      esAdministrador: rolActivo === ROL_ADMIN,
      puedeVer: (modulo: string) =>
        Boolean(MODULOS_POR_ROL[rolActivo]?.includes(modulo)),
      recargar: cargar,
      establecerSesion,
      cambiarRol,
      salir,
    };
  }, [usuario, cargando, rutaRolPendiente, cerrandoSesion, error, cargar, establecerSesion, cambiarRol, salir]);

  return (
    <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>
  );
}

export function useSesion(): ValorSesion {
  const contexto = useContext(ContextoSesion);

  if (!contexto) {
    throw new Error("useSesion debe usarse dentro de <ProveedorSesion>");
  }

  return contexto;
}
