"""Contratos Pydantic de entrada y salida para usuario y autenticacion."""

import re
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


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


class UsuarioRegistro(UsuarioCrear):
    """Reglas del formulario público sin alterar otros flujos de usuarios."""

    nombre: str = Field(min_length=2, max_length=60)

    @field_validator("nombre", mode="before")
    @classmethod
    def normalizar_nombre(cls, valor):
        return valor.strip() if isinstance(valor, str) else valor

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, valor: str) -> str:
        if not re.fullmatch(r"[A-Za-zÁÉÍÓÚáéíóúÑñÜü ]+", valor):
            raise ValueError("El nombre solo puede tener letras y espacios.")
        return valor

    @field_validator("correo", mode="before")
    @classmethod
    def validar_correo_registro(cls, valor):
        if isinstance(valor, str):
            valor = valor.strip()
            if len(valor) > 254 or not re.fullmatch(r"[^\s@]+@(?:[^\s@.]+\.)+[^\s@.]+", valor):
                raise ValueError("Escribe un correo válido de máximo 254 caracteres.")
        return valor

    @field_validator("documento", "telefono", mode="before")
    @classmethod
    def opcional_vacio(cls, valor):
        return None if valor == "" else valor

    @field_validator("documento")
    @classmethod
    def validar_documento(cls, valor: Optional[str]) -> Optional[str]:
        if valor is not None and not re.fullmatch(r"[0-9]{6,12}", valor):
            raise ValueError("El documento debe tener entre 6 y 12 dígitos.")
        return valor

    @field_validator("telefono")
    @classmethod
    def validar_telefono(cls, valor: Optional[str]) -> Optional[str]:
        if valor is not None and not re.fullmatch(r"[0-9]{7,10}", valor):
            raise ValueError("El teléfono debe tener entre 7 y 10 dígitos.")
        return valor

    @field_validator("direccion", mode="before")
    @classmethod
    def normalizar_direccion(cls, valor):
        if isinstance(valor, str):
            return valor.strip() or None
        return valor

    @field_validator("password")
    @classmethod
    def validar_password(cls, valor: str) -> str:
        if len(valor.encode("utf-8")) > 72:
            raise ValueError("La contraseña no puede superar 72 bytes.")
        if not re.search(r"[A-Za-zÁÉÍÓÚáéíóúÑñÜü]", valor):
            raise ValueError("La contraseña debe contener una letra.")
        if not re.search(r"[0-9]", valor):
            raise ValueError("La contraseña debe contener un número.")
        if not any(c in "!@#$%^&*()_+-=[]{};':\"\\|,.<>/?~`" for c in valor):
            raise ValueError("La contraseña debe contener un carácter especial.")
        return valor


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


class UsuarioDetalleRespuesta(UsuarioRespuesta):
    """Ficha de un usuario con los roles que tiene activos.

    `roles_activos` se calcula (no es una columna): sale de la tabla puente
    usuario_rol mas el rol por defecto. Es lo que el administrador necesita
    ver para saber con cuales roles puede entrar esa persona.
    """

    roles_activos: list[int] = []


class CambioPasswordEntrada(BaseModel):
    """El propio usuario cambia su contrasena: tiene que saber la actual."""

    password_actual: str = Field(min_length=1, max_length=72)
    password_nueva: str = Field(min_length=8, max_length=72)


class RestablecerPasswordEntrada(BaseModel):
    """El administrador le pone una contrasena nueva a un usuario.

    No se pide la anterior: el administrador no la conoce.
    """

    password_nueva: str = Field(min_length=8, max_length=72)


class LoginEntrada(BaseModel):
    """Credenciales. `id_rol` es opcional y solo hace falta si el usuario
    tiene MAS de un rol y quiere entrar con uno distinto al de por defecto."""

    correo: EmailStr
    password: str = Field(min_length=1, max_length=72)
    id_rol: Optional[int] = Field(
        default=None,
        gt=0,
        description="Rol con el que se quiere entrar. Si se omite, se usa el de por defecto",
    )


class RolDisponible(BaseModel):
    """Un rol que el usuario puede elegir al iniciar sesion."""

    id_rol: int
    nombre_rol: Optional[str] = None
    descripcion_rol: Optional[str] = None
    es_por_defecto: bool = False


class MisRolesRespuesta(BaseModel):
    """Lo que devuelve el boton 'cambiar rol': con cuales puede entrar."""

    id_usuario: int
    nombre: str
    rol_actual: Optional[int] = None
    roles: list[RolDisponible]


class CambiarRolEntrada(BaseModel):
    id_rol: int = Field(gt=0, description="Rol con el que se quiere continuar")


class TokenSalida(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expira_en_minutos: int
    # Cual de sus roles quedo activo en este token.
    id_rol: Optional[int] = None
    nombre_rol: Optional[str] = None
