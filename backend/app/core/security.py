"""Hashing de contrasenas y emision/validacion de tokens JWT.

La BD ya trae contrasenas BCrypt ($2a$10$...), por eso se usa la libreria
`bcrypt` directamente y NO argon2 (argon2 no puede verificar esos hashes).

Sobre el ROL EN EL TOKEN
------------------------
El sistema es **multirol**: un usuario puede tener varios roles (Administrador
y Vendedor, por ejemplo) y **elige con cual entra**. Ese rol elegido viaja en
el token, en la clave `rol`.

Por que en el token y no en un header:
  - El token ya esta firmado: nadie puede cambiarse el rol editandolo.
  - Cada rol activo es una sesion independiente, con su propia expiracion.
  - Cambiar de rol emite un token nuevo; el anterior sigue siendo valido hasta
    que expire (no hace falta una tabla de sesiones).

Un token SIN la clave `rol` es un token viejo (emitido antes de este modulo):
se trata como "todos los roles del usuario", para no romper sesiones abiertas.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from app.core.config import configuracion

MINUTOS_EXPIRACION_TOKEN = 60

# Nombre de la clave del rol activo dentro del payload del token.
CLAVE_ROL = "rol"


def hashear_password(password: str) -> str:
    """Devuelve el hash BCrypt de una contrasena en texto plano."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_password(password: str, hash_guardado: str) -> bool:
    """Compara una contrasena en texto plano contra un hash BCrypt."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hash_guardado.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def crear_token_acceso(
    usuario_id: int,
    id_rol: int | None = None,
    minutos: int = MINUTOS_EXPIRACION_TOKEN,
) -> str:
    """Emite un token para un usuario con un rol activo concreto.

    `id_rol` es el rol con el que va a operar. Se guarda en el payload para que
    la autorizacion no tenga que adivinarlo.
    """
    ahora = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(usuario_id),
        "iat": ahora,
        "exp": ahora + timedelta(minutes=minutos),
    }
    if id_rol is not None:
        payload[CLAVE_ROL] = int(id_rol)
    return jwt.encode(payload, configuracion.secret_key, algorithm=configuracion.algorithm)


def decodificar_token(token: str) -> dict[str, Any]:
    """Lanza jwt.PyJWTError si el token es invalido o expiro."""
    return jwt.decode(
        token, configuracion.secret_key, algorithms=[configuracion.algorithm]
    )
