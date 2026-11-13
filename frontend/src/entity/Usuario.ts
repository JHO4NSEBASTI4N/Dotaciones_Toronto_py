// src/entity/Usuario.ts
//
// Tabla `usuario`.
// Equivale a la clase Usuario.java del proyecto Java.

import type { ParametrosPagina } from "./Pagina";

export interface Usuario {
  id_usuario: number;
  nombre: string;
  correo: string;
  documento: string | null;
  telefono: string | null;
  direccion: string | null;
  estado: string | null; // "Habilitado" | "Inhabilitado"
  id_rol_fk: number | null;
}

export interface UsuarioDetalle extends Usuario {
  /** Roles con los que puede entrar (los de la tabla usuario_rol). */
  roles_activos: number[];
}

export interface UsuarioCrear {
  nombre: string;
  correo: string;
  documento?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  password: string;
}

export interface UsuarioActualizar {
  nombre?: string;
  documento?: string | null;
  telefono?: string | null;
  direccion?: string | null;
}

export interface FiltrosUsuario extends ParametrosPagina {
  correo?: string;
  nombre?: string;
  estado?: string;
  id_rol?: number;
}

export interface LoginEntrada {
  correo: string;
  password: string;
  /** Solo si tiene varios roles y quiere entrar con uno distinto al de por defecto. */
  id_rol?: number | null;
}

export interface TokenSalida {
  access_token: string;
  token_type: string;
  expira_en_minutos: number;
  id_rol: number | null;
  nombre_rol: string | null;
}

export interface RegistroEntrada {
  nombre: string;
  correo: string;
  documento?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  password: string;
}
