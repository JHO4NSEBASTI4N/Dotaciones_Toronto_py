"""Acceso a datos de usuario. No hace commit: la transaccion la cierra el servicio."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioCrear
from app.core.security import hashear_password


class UsuarioRepositorio:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def buscar_por_id(self, id_usuario: int) -> Usuario | None:
        return self.sesion.get(Usuario, id_usuario)

    def buscar_por_correo(self, correo: str) -> Usuario | None:
        return self.sesion.scalar(select(Usuario).where(Usuario.correo == correo))

    def listar(self, saltar: int = 0, limite: int = 50) -> list[Usuario]:
        consulta = select(Usuario).offset(saltar).limit(limite).order_by(Usuario.id_usuario)
        return list(self.sesion.scalars(consulta))

    def crear(self, datos: UsuarioCrear) -> Usuario:
        usuario = Usuario(
            **datos.model_dump(exclude={"password"}),
            password=hashear_password(datos.password),
            estado="Habilitado",
        )
        self.sesion.add(usuario)
        self.sesion.flush()
        return usuario
