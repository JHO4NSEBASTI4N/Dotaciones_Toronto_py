"""Dependencias reutilizables de FastAPI (sesion, usuario actual, roles)."""

from typing import Annotated

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.exceptions import NoAutorizado, Prohibido
from app.core.security import decodificar_token
from app.database.connection import obtener_sesion
from app.models.usuario import Usuario

# Ruta de login: OAuth2PasswordBearer la usa para el boton "Authorize" de /docs
esquema_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

SesionBD = Annotated[Session, Depends(obtener_sesion)]
TokenAcceso = Annotated[str, Depends(esquema_oauth2)]


def obtener_usuario_actual(sesion: SesionBD, token: TokenAcceso) -> Usuario:
    try:
        payload = decodificar_token(token)
        usuario_id = int(payload["sub"])
    except Exception:
        raise NoAutorizado("Token invalido o expirado")

    usuario = sesion.get(Usuario, usuario_id)
    if usuario is None:
        raise NoAutorizado("El usuario del token ya no existe")
    if (usuario.estado or "").lower() != "habilitado":
        raise Prohibido("El usuario esta inhabilitado")
    return usuario


UsuarioActual = Annotated[Usuario, Depends(obtener_usuario_actual)]


def roles_de(usuario: Usuario) -> set[int]:
    """Roles efectivos del usuario.

    DECISION PENDIENTE DEL EQUIPO: la BD tiene dos fuentes de verdad
    (`usuario.id_rol_fk` y la tabla puente `usuario_rol`). Mientras se decide
    cual es la oficial, se toma la union de ambas para no perder permisos.
    """
    roles = {ur.id_rol_fk for ur in usuario.usuario_roles}
    if usuario.id_rol_fk is not None:
        roles.add(usuario.id_rol_fk)
    return roles


def requiere_rol(*ids_rol: int):
    """Fabrica de dependencias: exige que el usuario tenga alguno de los roles."""

    def verificador(usuario: UsuarioActual) -> Usuario:
        if not roles_de(usuario) & set(ids_rol):
            raise Prohibido("No tiene el rol requerido para esta operacion")
        return usuario

    return verificador


ROL_ADMINISTRADOR = 1
ROL_CLIENTE = 2
ROL_VENDEDOR = 3
ROL_BODEGUERO = 4
