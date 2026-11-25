"""Schemas del modulo de roles y del multirol.

Un usuario puede tener varios roles y elegir con cual iniciar sesion. El
administrador decide que roles tiene cada usuario; quitarle uno NO lo borra:
lo deja en `activo = 0` para conservar el historial.
"""

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RolRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_rol: int
    nombre_rol: Optional[str] = None
    descripcion_rol: Optional[str] = None
    activo: bool = True

    @field_validator("activo", mode="before")
    @classmethod
    def activo_por_defecto(cls, valor: object) -> bool:
        # La columna es tinyint(1): puede llegar 0/1 en vez de True/False.
        return True if valor is None else bool(valor)


class RolCrear(BaseModel):
    nombre_rol: str = Field(min_length=3, max_length=50)
    descripcion_rol: Optional[str] = Field(default=None, max_length=150)

    @field_validator("nombre_rol", mode="before")
    @classmethod
    def nombre_normalizado(cls, valor: object) -> object:
        return " ".join(valor.split()) if isinstance(valor, str) else valor

    @field_validator("descripcion_rol", mode="before")
    @classmethod
    def descripcion_normalizada(cls, valor: object) -> object:
        if isinstance(valor, str):
            return " ".join(valor.split()) or None
        return valor


class RolActualizar(BaseModel):
    nombre_rol: Optional[str] = Field(default=None, min_length=3, max_length=50)
    descripcion_rol: Optional[str] = Field(default=None, max_length=150)

    @field_validator("nombre_rol", mode="before")
    @classmethod
    def nombre_normalizado(cls, valor: object) -> object:
        if valor is None:
            return None
        return " ".join(valor.split()) if isinstance(valor, str) else valor

    @field_validator("nombre_rol")
    @classmethod
    def nombre_no_vacio(cls, valor: Optional[str]) -> Optional[str]:
        if valor is None or len(valor) < 3:
            raise ValueError("El nombre del rol debe tener entre 3 y 50 caracteres.")
        return valor

    @field_validator("descripcion_rol", mode="before")
    @classmethod
    def descripcion_normalizada(cls, valor: object) -> object:
        if valor is None:
            return None
        return " ".join(valor.split()) or None if isinstance(valor, str) else valor


class AsignacionRol(BaseModel):
    """Asignar o retirar un rol a un usuario."""

    id_rol: int = Field(gt=0, description="Rol que se asigna o se retira")


class RolDeUsuarioRespuesta(BaseModel):
    """Un rol visto desde la ficha de un usuario."""

    id_rol: int
    nombre_rol: Optional[str] = None
    descripcion_rol: Optional[str] = None
    activo: bool = True
    asignado: bool = False
    es_rol_por_defecto: bool = False


class RolesDeUsuarioRespuesta(BaseModel):
    id_usuario: int
    nombre: str
    correo: str
    roles: list[RolDeUsuarioRespuesta]
    # Cuales puede elegir hoy para iniciar sesion.
    roles_activos: list[int] = []
