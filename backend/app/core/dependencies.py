"""Dependencias reutilizables de FastAPI (sesion, usuario actual, roles).

MULTIROL
--------
Un usuario puede tener varios roles activos y **elige con cual entra**. Ese
rol activo viaja en el token (clave `rol`) y es el que manda para autorizar:
si un usuario es Administrador y Vendedor pero entro como Vendedor, no puede
hacer operaciones de administrador hasta que pida un token con ese otro rol.

`roles_de(usuario)` devuelve el conjunto de roles que aplican a la peticion
actual:
  - token con `rol`      -> ese unico rol
  - token sin `rol` (viejo) -> todos sus roles activos (compatibilidad)
"""

from typing import Annotated

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.exceptions import NoAutorizado, Prohibido
from app.core.security import CLAVE_ROL, decodificar_token
from app.database.connection import obtener_sesion
from app.models.usuario import Usuario

# Ruta de login: OAuth2PasswordBearer la usa para el boton "Authorize" de /docs
esquema_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

SesionBD = Annotated[Session, Depends(obtener_sesion)]
TokenAcceso = Annotated[str, Depends(esquema_oauth2)]


# --- roles ---------------------------------------------------------------------

def roles_asignados(usuario: Usuario) -> set[int]:
    """Todos los roles ACTIVOS del usuario, sin importar con cual entro.

    Es la lista que se le muestra en el boton "cambiar rol".
    """
    roles: set[int] = set()
    for asignacion in usuario.usuario_roles:
        if not asignacion.activo:
            continue
        # Si el rol esta desactivado en la tabla `rol`, tampoco cuenta.
        if asignacion.rol is not None and not asignacion.rol.activo:
            continue
        roles.add(asignacion.id_rol_fk)

    # La columna vieja `usuario.id_rol_fk` sigue siendo valida mientras el
    # equipo no decida cual de las dos fuentes es la oficial.
    if usuario.id_rol_fk is not None:
        roles.add(usuario.id_rol_fk)
    return roles


def roles_de(usuario: Usuario) -> set[int]:
    """Roles que aplican a la peticion actual.

    Si el token trajo un rol activo, SOLO ese. Si es un token viejo sin rol,
    se cae al comportamiento anterior (todos sus roles).
    """
    rol_activo = getattr(usuario, "rol_activo", None)
    if rol_activo is not None:
        return {rol_activo}
    return roles_asignados(usuario)


def _resolver_rol_activo(usuario: Usuario, rol_del_token: object) -> int | None:
    """Valida que el rol del token siga siendo valido para este usuario.

    Motivo: si un administrador le quita un rol a alguien, los tokens que esa
    persona ya tenia emitidos con ese rol deben dejar de servir de inmediato.
    """
    disponibles = roles_asignados(usuario)

    if rol_del_token is None:
        # Token viejo (emitido antes del multirol): todos sus roles.
        return None

    try:
        id_rol = int(rol_del_token)
    except (TypeError, ValueError):
        raise NoAutorizado("Token invalido: el rol no es valido")

    if id_rol not in disponibles:
        raise Prohibido(
            "El rol con el que inicio sesion ya no esta asignado a su usuario. "
            "Vuelva a iniciar sesion."
        )
    return id_rol


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

    # Se deja el rol activo en el objeto para que `roles_de()` lo vea.
    # Es un atributo en memoria: no es una columna y no se guarda.
    usuario.rol_activo = _resolver_rol_activo(usuario, payload.get(CLAVE_ROL))
    return usuario


UsuarioActual = Annotated[Usuario, Depends(obtener_usuario_actual)]


def requiere_rol(*ids_rol: int):
    """Fabrica de dependencias: exige que el ROL ACTIVO sea alguno de estos."""

    def verificador(usuario: UsuarioActual) -> Usuario:
        if not roles_de(usuario) & set(ids_rol):
            raise Prohibido(
                "No tiene el rol requerido para esta operacion con el rol "
                "con el que inicio sesion"
            )
        return usuario

    return verificador


# Identificadores de rol que trae la base
ROL_ADMINISTRADOR = 1
ROL_CLIENTE = 2
ROL_VENDEDOR = 3
ROL_BODEGUERO = 4

NOMBRES_ROL = {
    ROL_ADMINISTRADOR: "Administrador",
    ROL_CLIENTE: "Cliente",
    ROL_VENDEDOR: "Vendedor",
    ROL_BODEGUERO: "Bodeguero",
}
