"""Acceso a datos de usuario. No hace commit: la transaccion la cierra el servicio.

Aqui NO se borra nada: el usuario que deja de estar activo pasa a
`estado = "Inhabilitado"` (regla del proyecto).
"""

from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.security import hashear_password
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from app.schemas.usuario import UsuarioActualizar, UsuarioCrear


class UsuarioRepositorio:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    # --- consultas --------------------------------------------------------

    def buscar_por_id(self, id_usuario: int) -> Usuario | None:
        return self.sesion.get(Usuario, id_usuario)

    def buscar_por_correo(self, correo: str) -> Usuario | None:
        return self.sesion.scalar(select(Usuario).where(Usuario.correo == correo))

    def listar(self, saltar: int = 0, limite: int = 50) -> list[Usuario]:
        consulta = select(Usuario).offset(saltar).limit(limite).order_by(Usuario.id_usuario)
        return list(self.sesion.scalars(consulta))

    def listar_filtrado(
        self,
        saltar: int = 0,
        limite: int = 20,
        correo: Optional[str] = None,
        nombre: Optional[str] = None,
        estado: Optional[str] = None,
        id_rol: Optional[int] = None,
    ) -> tuple[list[Usuario], int]:
        """Usuarios filtrados + el total (para paginar).

        `id_rol` busca tanto en la columna vieja `id_rol_fk` como en la tabla
        puente `usuario_rol`: un usuario "es" de un rol si cualquiera de las
        dos fuentes lo dice.
        """
        condiciones = []

        if correo:
            condiciones.append(Usuario.correo.like(f"%{correo}%"))
        if nombre:
            condiciones.append(Usuario.nombre.like(f"%{nombre}%"))
        if estado:
            condiciones.append(func.lower(Usuario.estado) == estado.lower())
        if id_rol is not None:
            usuarios_con_rol = select(UsuarioRol.id_usuario_fk).where(
                UsuarioRol.id_rol_fk == id_rol,
                UsuarioRol.activo.is_(True),
            )
            condiciones.append(
                or_(
                    Usuario.id_rol_fk == id_rol,
                    Usuario.id_usuario.in_(usuarios_con_rol),
                )
            )

        base = select(Usuario)
        if condiciones:
            base = base.where(*condiciones)

        total = self.sesion.scalar(
            select(func.count()).select_from(base.subquery())
        ) or 0

        consulta = (
            base.order_by(Usuario.id_usuario).offset(saltar).limit(limite)
        )
        return list(self.sesion.scalars(consulta)), total

    def contar_con_rol_habilitados(self, id_rol: int) -> int:
        """Cuantos usuarios HABILITADOS tienen ese rol.

        Sirve para no dejar el sistema sin ningun administrador: si solo queda
        uno, no se le puede inhabilitar el usuario.
        """
        usuarios_con_rol = select(UsuarioRol.id_usuario_fk).where(
            UsuarioRol.id_rol_fk == id_rol,
            UsuarioRol.activo.is_(True),
        )
        consulta = (
            select(func.count())
            .select_from(Usuario)
            .where(
                func.lower(Usuario.estado) == "habilitado",
                or_(
                    Usuario.id_rol_fk == id_rol,
                    Usuario.id_usuario.in_(usuarios_con_rol),
                ),
            )
        )
        return self.sesion.scalar(consulta) or 0

    # --- escritura --------------------------------------------------------

    def crear(self, datos: UsuarioCrear) -> Usuario:
        usuario = Usuario(
            **datos.model_dump(exclude={"password"}),
            password=hashear_password(datos.password),
            estado="Habilitado",
        )
        self.sesion.add(usuario)
        self.sesion.flush()
        return usuario

    def actualizar(self, usuario: Usuario, datos: UsuarioActualizar) -> Usuario:
        """Cambia solo los campos que llegan (los que no, quedan igual)."""
        for campo, valor in datos.model_dump(exclude_unset=True).items():
            setattr(usuario, campo, valor)
        self.sesion.flush()
        return usuario

    def cambiar_password(self, usuario: Usuario, password_nueva: str) -> Usuario:
        usuario.password = hashear_password(password_nueva)
        self.sesion.flush()
        return usuario

    def cambiar_estado(self, usuario: Usuario, estado: str) -> Usuario:
        usuario.estado = estado
        self.sesion.flush()
        return usuario
