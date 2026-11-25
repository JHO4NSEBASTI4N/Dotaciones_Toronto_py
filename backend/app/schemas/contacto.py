"""Datos admitidos para el formulario publico de contacto."""
from pydantic import BaseModel, EmailStr, Field, field_validator


class MensajeContacto(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    correo: EmailStr = Field(max_length=254)
    mensaje: str = Field(min_length=1, max_length=3000)

    @field_validator("correo", mode="before")
    @classmethod
    def normalizar_correo(cls, valor):
        return valor.strip() if isinstance(valor, str) else valor

    @field_validator("nombre", "mensaje", mode="before")
    @classmethod
    def quitar_espacios(cls, valor):
        return valor.strip() if isinstance(valor, str) else valor

    @field_validator("nombre")
    @classmethod
    def nombre_en_una_linea(cls, valor: str) -> str:
        if "\n" in valor or "\r" in valor:
            raise ValueError("El nombre debe estar en una sola línea")
        return valor
