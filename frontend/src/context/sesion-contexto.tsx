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

import { useNavigate } from "react-router-dom";

import { auth } from "../services/api";
import { autenticacion } from "../services/autenticacion";
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
    "dashboard", "usuarios", "roles", "productos", "pedidos", "ventas",
    "devoluciones", "inventario", "alertas", "facturacion", "perfil",
  ],
  2: ["dashboard", "catalogo", "carrito", "mis-pedidos", "devoluciones", "perfil"],
  3: ["dashboard", "pedidos", "ventas", "devoluciones", "perfil"],
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
  error: string;
  esAdministrador: boolean;
  rolActivo: number;
  puedeVer: (modulo: string) => boolean;
  recargar: () => Promise<void>;
  establecerSesion: () => Promise<void>;
  cambiarRol: (idRol: number) => Promise<void>;
  salir: () => void;
}

const ContextoSesion = createContext<ValorSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const navegar = useNavigate();

  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  /** Pide /auth/yo + /auth/mis-roles y arma el objeto de sesión. */
  const cargar = useCallback(async () => {
    if (!autenticacion.estaAutenticado()) {
      setUsuario(null);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError("");

    try {
      const [detalle, roles] = await Promise.all([
        auth.yo() as Promise<UsuarioDetalle & { id_rol_fk?: number }>,
        autenticacion.misRoles(),
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
    } catch {
      autenticacion.logout();
      setUsuario(null);
      setError("Tu sesión expiró. Inicia sesión nuevamente.");
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

  /** Botón "cambiar rol": el backend emite un token nuevo con el otro rol. */
  const cambiarRol = useCallback(
    async (idRol: number) => {
      await autenticacion.cambiarRol(idRol);
      await cargar();

      const destino: Record<number, string> = {
        1: "/admin/panel",
        2: "/cliente/panel",
        3: "/vendedor/panel",
        4: "/bodeguero/panel",
      };
      navegar(destino[idRol] ?? "/login", { replace: true });
    },
    [cargar, navegar]
  );

  const salir = useCallback(() => {
    autenticacion.logout();
    setUsuario(null);
    navegar("/login", { replace: true });
  }, [navegar]);

  const valor = useMemo<ValorSesion>(() => {
    const rolActivo = usuario?.id_rol ?? 0;

    return {
      usuario,
      cargando,
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
  }, [usuario, cargando, error, cargar, establecerSesion, cambiarRol, salir]);

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
