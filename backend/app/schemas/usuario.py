"""Contratos Pydantic de entrada y salida para usuario y autenticacion."""

import re
import unicodedata
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


CARACTERES_ESPECIALES_PASSWORD = set("!@#$%^&*()_+-=[]{};':\\\"\\\\|,.<>/?~`")


def validar_password_segura(valor: str) -> str:
    """Regla común para cualquier creación o cambio de contraseña."""
    if len(valor.encode("utf-8")) > 72:
        raise ValueError("La contraseña no puede superar 72 bytes.")
    if not any(caracter.isalpha() for caracter in valor):
        raise ValueError("La contraseña debe contener una letra.")
    if not any(caracter.isdigit() for caracter in valor):
        raise ValueError("La contraseña debe contener un número.")
    if not any(caracter in CARACTERES_ESPECIALES_PASSWORD for caracter in valor):
        raise ValueError("La contraseña debe contener un carácter especial.")
    return valor


def _normalizar_opcional(valor):
    if isinstance(valor, str):
        return valor.strip() or None
    return valor


def _validar_telefono(valor: Optional[str]) -> Optional[str]:
    """Valida teléfonos nacionales e internacionales sin asumir un país predeterminado."""
    if valor is None:
        return None
    limpio = valor.strip()
    if not limpio:
        return None
    if len(limpio) > 32:
        raise ValueError("El teléfono no puede superar 32 caracteres.")
    if not re.fullmatch(r"[0-9+(). -]+", limpio):
        raise ValueError("El teléfono solo admite números, +, espacios, paréntesis, guiones y puntos.")
    if "+" in limpio and (not limpio.startswith("+") or limpio.count("+") != 1):
        raise ValueError("El signo + solo se permite una vez, al inicio del prefijo internacional.")

    dentro_de_parentesis = False
    digitos_parentesis = 0
    for caracter in limpio:
        if caracter == "(":
            if dentro_de_parentesis:
                raise ValueError("Revisa los paréntesis del teléfono.")
            dentro_de_parentesis = True
            digitos_parentesis = 0
        elif caracter == ")":
            if not dentro_de_parentesis or digitos_parentesis == 0:
                raise ValueError("Revisa los paréntesis del teléfono.")
            dentro_de_parentesis = False
        elif dentro_de_parentesis and caracter in "0123456789":
            digitos_parentesis += 1
    if dentro_de_parentesis:
        raise ValueError("Cierra los paréntesis del teléfono.")

    digitos = re.sub(r"[^0-9]", "", limpio)
    if not 7 <= len(digitos) <= 15:
        raise ValueError("El teléfono debe contener entre 7 y 15 dígitos; el máximo internacional es 15.")
    if limpio.startswith("+") and digitos.startswith("0"):
        raise ValueError("El código internacional no puede comenzar por 0.")
    return limpio


def _validar_nombre_persona(valor: str) -> str:
    """Admite letras Unicode, espacios y separadores usuales de nombres."""
    limpio = " ".join(valor.split())
    if len(limpio) < 2:
        raise ValueError("El nombre debe tener al menos 2 caracteres.")
    permitidos = {" ", "'", "’", "-", "."}
    if not any(unicodedata.category(c).startswith("L") for c in limpio):
        raise ValueError("El nombre debe incluir letras.")
    if any(
        not unicodedata.category(c).startswith(("L", "M")) and c not in permitidos
        for c in limpio
    ):
        raise ValueError("El nombre solo admite letras, espacios, apóstrofe, guion y punto.")
    return limpio


class UsuarioBase(BaseModel):
    nombre: str = Field(min_length=2, max_length=255)
    correo: EmailStr
    documento: Optional[str] = Field(default=None, max_length=12)
    telefono: Optional[str] = Field(default=None, max_length=32)
    direccion: Optional[str] = Field(default=None, max_length=255)

    @field_validator("nombre", mode="before")
    @classmethod
    def normalizar_nombre_base(cls, valor):
        return " ".join(valor.split()) if isinstance(valor, str) else valor

    @field_validator("nombre")
    @classmethod
    def validar_nombre_base(cls, valor: str) -> str:
        return _validar_nombre_persona(valor)

    @field_validator("correo", mode="before")
    @classmethod
    def normalizar_correo(cls, valor):
        if isinstance(valor, str):
            valor = valor.strip()
            if len(valor) > 254:
                raise ValueError("El correo no puede superar 254 caracteres.")
        return valor

    @field_validator("documento", "telefono", "direccion", mode="before")
    @classmethod
    def normalizar_campos_opcionales(cls, valor):
        return _normalizar_opcional(valor)

    @field_validator("documento")
    @classmethod
    def validar_documento(cls, valor: Optional[str]) -> Optional[str]:
        if valor is not None and not re.fullmatch(r"[0-9]{6,12}", valor):
            raise ValueError("El documento debe tener entre 6 y 12 dígitos.")
        return valor

    @field_validator("telefono")
    @classmethod
    def validar_telefono(cls, valor: Optional[str]) -> Optional[str]:
        return _validar_telefono(valor)


class UsuarioCrear(UsuarioBase):
    """Lo que envia el cliente al registrarse.

    Nota: no incluye `id_rol_fk`, `estado` ni `inhabilitado` a proposito:
    esos campos los decide el servidor (evita mass assignment).
    """

    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def validar_password(cls, valor: str) -> str:
        return validar_password_segura(valor)


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
        return _validar_nombre_persona(valor)

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
        return _normalizar_opcional(valor)

    @field_validator("documento")
    @classmethod
    def validar_documento(cls, valor: Optional[str]) -> Optional[str]:
        if valor is not None and not re.fullmatch(r"[0-9]{6,12}", valor):
            raise ValueError("El documento debe tener entre 6 y 12 dígitos.")
        return valor

    @field_validator("telefono")
    @classmethod
    def validar_telefono(cls, valor: Optional[str]) -> Optional[str]:
        return _validar_telefono(valor)

    @field_validator("direccion", mode="before")
    @classmethod
    def normalizar_direccion(cls, valor):
        if isinstance(valor, str):
            return valor.strip() or None
        return valor

    @field_validator("password")
    @classmethod
    def validar_password(cls, valor: str) -> str:
        return validar_password_segura(valor)


class UsuarioActualizar(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=255)
    documento: Optional[str] = Field(default=None, max_length=12)
    telefono: Optional[str] = Field(default=None, max_length=32)
    direccion: Optional[str] = Field(default=None, max_length=255)

    @field_validator("nombre", mode="before")
    @classmethod
    def normalizar_nombre(cls, valor):
        if valor is None:
            return None
        return " ".join(valor.split()) if isinstance(valor, str) else valor

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, valor: Optional[str]) -> Optional[str]:
        return _validar_nombre_persona(valor) if valor is not None else None

    @field_validator("documento", "telefono", "direccion", mode="before")
    @classmethod
    def normalizar_campos(cls, valor):
        return _normalizar_opcional(valor)

    @field_validator("documento")
    @classmethod
    def validar_documento(cls, valor: Optional[str]) -> Optional[str]:
        if valor is not None and not re.fullmatch(r"[0-9]{6,12}", valor):
            raise ValueError("El documento debe tener entre 6 y 12 dígitos.")
        return valor

    @field_validator("telefono")
    @classmethod
    def validar_telefono(cls, valor: Optional[str]) -> Optional[str]:
        return _validar_telefono(valor)


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

    @field_validator("password_nueva")
    @classmethod
    def validar_password_nueva(cls, valor: str) -> str:
        return validar_password_segura(valor)


class RestablecerPasswordEntrada(BaseModel):
    """El administrador le pone una contrasena nueva a un usuario.

    No se pide la anterior: el administrador no la conoce.
    """

    password_nueva: str = Field(min_length=8, max_length=72)

    @field_validator("password_nueva")
    @classmethod
    def validar_password_nueva(cls, valor: str) -> str:
        return validar_password_segura(valor)


class LoginEntrada(BaseModel):
    """Credenciales. `id_rol` es opcional y solo hace falta si el usuario
    tiene MAS de un rol y quiere entrar con uno distinto al de por defecto."""

    correo: EmailStr = Field(max_length=254)
    password: str = Field(min_length=1, max_length=72)

    @field_validator("correo", mode="before")
    @classmethod
    def normalizar_correo(cls, valor):
        return valor.strip() if isinstance(valor, str) else valor
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
