"""Hashing de contrasenas y emision/validacion de tokens JWT.

La BD ya trae contrasenas BCrypt ($2a$10$...), por eso se usa la libreria
`bcrypt` directamente y NO argon2 (argon2 no puede verificar esos hashes).
"""

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from app.core.config import configuracion

MINUTOS_EXPIRACION_TOKEN = 60


def hashear_password(password: str) -> str:
    """Devuelve el hash BCrypt de una contrasena en texto plano."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_password(password: str, hash_guardado: str) -> bool:
    """Compara una contrasena en texto plano contra un hash BCrypt."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hash_guardado.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def crear_token_acceso(usuario_id: int, minutos: int = MINUTOS_EXPIRACION_TOKEN) -> str:
    ahora = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(usuario_id),
        "iat": ahora,
        "exp": ahora + timedelta(minutes=minutos),
    }
    return jwt.encode(payload, configuracion.secret_key, algorithm=configuracion.algorithm)


def decodificar_token(token: str) -> dict[str, Any]:
    """Lanza jwt.PyJWTError si el token es invalido o expiro."""
    return jwt.decode(
        token, configuracion.secret_key, algorithms=[configuracion.algorithm]
    )
