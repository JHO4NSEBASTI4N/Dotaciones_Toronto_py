// src/services/autenticacion.ts
//
// Manejo de la sesion: token, usuario y ROL ACTIVO.
//
// El backend es MULTIROL y la respuesta del login NO trae el objeto usuario,
// solo el token y con cual rol se entro:
//
//   { access_token, token_type, expira_en_minutos, id_rol, nombre_rol }
//
// Los datos del usuario se piden aparte a GET /auth/yo. Se guardan las tres
// cosas en localStorage para no repetir peticiones en cada render.

import { auth } from "./api";
import type { MisRoles, RolDisponible, TokenSalida, Usuario, UsuarioDetalle } from "../types";

const CLAVE_TOKEN = "token";
const CLAVE_USUARIO = "usuario";
const CLAVE_ROL = "rol_activo";

/** Cual de sus roles esta usando ahora mismo. */
export interface RolActivo {
  id_rol: number;
  nombre_rol: string | null;
}

/** Mapa de rol a la pantalla de inicio de ese rol. */
export const RUTA_POR_ROL: Record<number, string> = {
  1: "/admin/panel",
  2: "/cliente/panel",
  3: "/vendedor/panel",
  4: "/bodeguero/panel",
};

export const NOMBRE_ROL: Record<number, string> = {
  1: "Administrador",
  2: "Cliente",
  3: "Vendedor",
  4: "Bodeguero",
};

function guardarSesion(token: string, usuario: Usuario | null, rol: RolActivo | null) {
  localStorage.setItem(CLAVE_TOKEN, token);
  if (usuario) localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
  if (rol) localStorage.setItem(CLAVE_ROL, JSON.stringify(rol));
}

export const autenticacion = {
  /**
   * Inicia sesion.
   *
   * @param idRol opcional: si el usuario tiene varios roles, con cual entrar.
   *              Si se omite, el backend usa el rol por defecto.
   */
  async login(correo: string, password: string, idRol?: number): Promise<TokenSalida> {
    const respuesta = await auth.login(correo, password, idRol);

    const rol: RolActivo = {
      id_rol: respuesta.id_rol ?? 0,
      nombre_rol: respuesta.nombre_rol,
    };
    guardarSesion(respuesta.access_token, null, rol);

    // Los datos del usuario van en otra peticion.
    try {
      const usuario = await auth.yo();
      localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
    } catch {
      // Si falla /auth/yo no se rompe el login: la sesion ya esta guardada.
    }

    return respuesta;
  },

  /** Registro publico. Siempre crea un Cliente: el rol lo decide el servidor. */
  async registrar(datos: {
    nombre: string;
    correo: string;
    documento?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    password: string;
  }): Promise<Usuario> {
    return auth.registro(datos);
  },

  /** Cierra sesion en el navegador (el token se descarta). */
  logout(): void {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
    localStorage.removeItem(CLAVE_ROL);
  },

  obtenerToken(): string | null {
    return localStorage.getItem(CLAVE_TOKEN);
  },

  usuarioActual(): Usuario | null {
    const guardado = localStorage.getItem(CLAVE_USUARIO);
    if (!guardado) return null;
    try {
      return JSON.parse(guardado) as Usuario;
    } catch {
      return null;
    }
  },

  /** Refresca los datos del usuario desde el backend. */
  async recargarUsuario(): Promise<UsuarioDetalle | null> {
    if (!this.estaAutenticado()) return null;
    const usuario = await auth.yo();
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
    return usuario;
  },

  rolActual(): RolActivo | null {
    const guardado = localStorage.getItem(CLAVE_ROL);
    if (!guardado) return null;
    try {
      return JSON.parse(guardado) as RolActivo;
    } catch {
      return null;
    }
  },

  /** Los roles con los que este usuario puede entrar (boton "cambiar rol"). */
  async misRoles(): Promise<RolDisponible[]> {
    const datos: MisRoles = await auth.misRoles();
    return datos.roles;
  },

  /**
   * Cambia el rol activo. El backend emite un token NUEVO con ese rol dentro,
   * asi que hay que reemplazar el token guardado.
   */
  async cambiarRol(idRol: number): Promise<TokenSalida> {
    const respuesta = await auth.cambiarRol(idRol);
    const rol: RolActivo = {
      id_rol: respuesta.id_rol ?? idRol,
      nombre_rol: respuesta.nombre_rol ?? NOMBRE_ROL[idRol] ?? null,
    };
    localStorage.setItem(CLAVE_TOKEN, respuesta.access_token);
    localStorage.setItem(CLAVE_ROL, JSON.stringify(rol));
    return respuesta;
  },

  estaAutenticado(): boolean {
    return !!localStorage.getItem(CLAVE_TOKEN);
  },

  /** true si el rol ACTIVO es alguno de los indicados. */
  tieneRol(...idsRol: number[]): boolean {
    const rol = this.rolActual();
    if (!rol) return false;
    return idsRol.includes(rol.id_rol);
  },

  esAdministrador(): boolean {
    return this.tieneRol(1);
  },

  /** A que pantalla mandarlo despues de entrar. */
  rutaDeInicio(): string {
    const rol = this.rolActual();
    return (rol && RUTA_POR_ROL[rol.id_rol]) || "/login";
  },
};
