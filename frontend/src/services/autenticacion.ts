// src/services/autenticacion.ts

import { api } from "./api";
import type {
  LoginRequest,
  LoginResponse,
  RegistroRequest,
  Usuario,
} from "../types";

const CLAVE_TOKEN = "token";
const CLAVE_USUARIO = "usuario";

export const autenticacion = {
  async login(datos: LoginRequest): Promise<LoginResponse> {
    const respuesta = await api.post<LoginResponse>("/auth/login", datos);
    localStorage.setItem(CLAVE_TOKEN, respuesta.token);
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(respuesta.usuario));
    return respuesta;
  },

  async registrar(datos: RegistroRequest): Promise<Usuario> {
    return api.post<Usuario>("/auth/registro", datos);
  },

  logout(): void {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
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

  estaAutenticado(): boolean {
    return !!localStorage.getItem(CLAVE_TOKEN);
  },

  // Roles: 1 Administrador, 2 Cliente, 3 Vendedor, 4 Bodeguero
  tieneRol(...idsRol: number[]): boolean {
    const usuario = this.usuarioActual();
    if (!usuario || usuario.id_rol_fk === null) return false;
    return idsRol.includes(usuario.id_rol_fk);
  },

  esAdministrador(): boolean {
    return this.tieneRol(1);
  },
};