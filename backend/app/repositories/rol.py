"""Acceso a datos de roles y de la tabla puente usuario_rol.

No hace commit: la transaccion la cierra el servicio.

REGLA DEL PROYECTO: la tabla puente no se vacia. Quitarle un rol a un usuario
es poner `usuario_rol.activo = 0`, para que quede el historial.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.rol import Rol
from app.models.usuario_rol import UsuarioRol


class RolRepositorio:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    # --- catalogo de roles ----------------------------------------------------

    def buscar_por_id(self, id_rol: int) -> Rol | None:
        return self.sesion.get(Rol, id_rol)

    def buscar_por_nombre(self, nombre_rol: str) -> Rol | None:
        return self.sesion.scalar(
            select(Rol).where(Rol.nombre_rol == nombre_rol)
        )

    def listar(self, solo_activos: bool = False) -> list[Rol]:
        consulta = select(Rol).order_by(Rol.id_rol)
        if solo_activos:
            consulta = consulta.where(Rol.activo == True)  # noqa: E712
        return list(self.sesion.scalars(consulta))

    def crear(self, nombre_rol: str, descripcion_rol: str | None) -> Rol:
        rol = Rol(
            nombre_rol=nombre_rol,
            descripcion_rol=descripcion_rol,
            activo=True,
        )
        self.sesion.add(rol)
        self.sesion.flush()
        return rol

    def guardar(self, rol: Rol) -> Rol:
        """Persiste cambios de nombre o descripcion."""
        self.sesion.flush()
        return rol

    def activar(self, rol: Rol) -> Rol:
        rol.activo = True
        self.sesion.flush()
        return rol

    def desactivar(self, rol: Rol) -> Rol:
        rol.activo = False
        self.sesion.flush()
        return rol

    # --- asignaciones usuario <-> rol -----------------------------------------

    def buscar_asignacion(self, id_usuario: int, id_rol: int) -> UsuarioRol | None:
        return self.sesion.scalar(
            select(UsuarioRol).where(
                UsuarioRol.id_usuario_fk == id_usuario,
                UsuarioRol.id_rol_fk == id_rol,
            )
        )

    def listar_asignaciones(self, id_usuario: int) -> list[UsuarioRol]:
        return list(
            self.sesion.scalars(
                select(UsuarioRol)
                .where(UsuarioRol.id_usuario_fk == id_usuario)
                .order_by(UsuarioRol.id_rol_fk)
            )
        )

    def crear_asignacion(self, id_usuario: int, id_rol: int) -> UsuarioRol:
        asignacion = UsuarioRol(
            id_usuario_fk=id_usuario, id_rol_fk=id_rol, activo=True
        )
        self.sesion.add(asignacion)
        self.sesion.flush()
        return asignacion

    def activar_asignacion(self, asignacion: UsuarioRol) -> UsuarioRol:
        asignacion.activo = True
        self.sesion.flush()
        return asignacion

    def desactivar_asignacion(self, asignacion: UsuarioRol) -> UsuarioRol:
        asignacion.activo = False
        self.sesion.flush()
        return asignacion

    def contar_usuarios_con_rol(self, id_rol: int) -> int:
        """Cuantos usuarios activos tienen ese rol (para no dejar el sistema sin admin)."""
        return len(
            [
                a
                for a in self.sesion.scalars(
                    select(UsuarioRol).where(
                        UsuarioRol.id_rol_fk == id_rol,
                        UsuarioRol.activo == True,  # noqa: E712
                    )
                )
            ]
        )
