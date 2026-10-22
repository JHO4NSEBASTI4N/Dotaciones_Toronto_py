"""Servicio de autenticacion. No importa fastapi: logica pura + SQLAlchemy."""

from sqlalchemy.orm import Session

from app.core.exceptions import Conflicto, NoAutorizado, Prohibido
from app.core.security import (
    MINUTOS_EXPIRACION_TOKEN,
    crear_token_acceso,
    verificar_password,
)
from app.models.usuario import Usuario
from app.repositories.usuario import UsuarioRepositorio
from app.schemas.usuario import LoginEntrada, UsuarioCrear


def registrar(sesion: Session, datos: UsuarioCrear) -> Usuario:
    repo = UsuarioRepositorio(sesion)
    if repo.buscar_por_correo(datos.correo):
        raise Conflicto("El correo ya esta registrado")

    usuario = repo.crear(datos)
    sesion.commit()
    sesion.refresh(usuario)
    return usuario


def autenticar(sesion: Session, credenciales: LoginEntrada) -> Usuario:
    repo = UsuarioRepositorio(sesion)
    usuario = repo.buscar_por_correo(credenciales.correo)

    # Mismo mensaje para correo inexistente y contrasena incorrecta:
    # no se revela cual de los dos fallo.
    if usuario is None or not verificar_password(credenciales.password, usuario.password):
        raise NoAutorizado("Correo o contrasena incorrectos")
    if (usuario.estado or "").lower() != "habilitado":
        raise Prohibido("El usuario esta inhabilitado")

    return usuario


def generar_token(usuario: Usuario) -> dict:
    return {
        "access_token": crear_token_acceso(usuario.id_usuario),
        "token_type": "bearer",
        "expira_en_minutos": MINUTOS_EXPIRACION_TOKEN,
    }


def listar_usuarios(sesion: Session, saltar: int = 0, limite: int = 50) -> list[Usuario]:
    return UsuarioRepositorio(sesion).listar(saltar=saltar, limite=limite)
