"""Contratos Pydantic de entrada y salida para usuario y autenticacion."""

from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UsuarioBase(BaseModel):
    nombre: str = Field(min_length=2, max_length=255)
    correo: EmailStr
    documento: Optional[str] = Field(default=None, max_length=255)
    telefono: Optional[str] = Field(default=None, max_length=255)
    direccion: Optional[str] = Field(default=None, max_length=255)


class UsuarioCrear(UsuarioBase):
    """Lo que envia el cliente al registrarse.

    Nota: no incluye `id_rol_fk`, `estado` ni `inhabilitado` a proposito:
    esos campos los decide el servidor (evita mass assignment).
    """

    password: str = Field(min_length=8, max_length=72)


class UsuarioActualizar(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=255)
    documento: Optional[str] = Field(default=None, max_length=255)
    telefono: Optional[str] = Field(default=None, max_length=255)
    direccion: Optional[str] = Field(default=None, max_length=255)


class UsuarioRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_usuario: int
    nombre: str
    correo: str
    documento: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    estado: Optional[str] = None
    id_rol_fk: Optional[int] = None


class LoginEntrada(BaseModel):
    correo: EmailStr
    password: str = Field(min_length=1, max_length=72)


class TokenSalida(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expira_en_minutos: int
