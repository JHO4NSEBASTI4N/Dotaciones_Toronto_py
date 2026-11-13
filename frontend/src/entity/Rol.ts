// src/entity/Rol.ts
//
// Tabla `rol`: los 4 roles base del sistema.
// Equivale a la clase Rol.java del proyecto Java.

export interface Rol {
  id_rol: number;
  nombre_rol: string | null;
  descripcion_rol: string | null;
  activo: boolean;
}

export interface RolCrear {
  nombre_rol: string;
  descripcion_rol?: string | null;
}

export interface RolDisponible {
  id_rol: number;
  nombre_rol: string | null;
  descripcion_rol: string | null;
  es_por_defecto: boolean;
}

export interface MisRoles {
  id_usuario: number;
  nombre: string;
  rol_actual: number | null;
  roles: RolDisponible[];
}

export interface RolesDeUsuario {
  id_usuario: number;
  nombre: string;
  correo: string;
  roles: Rol[];
  roles_activos: number[];
}
