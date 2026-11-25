from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.usuario import validar_password_segura


class SolicitudRecuperacion(BaseModel):
    correo: EmailStr = Field(max_length=254)

    @field_validator("correo", mode="before")
    @classmethod
    def normalizar_correo(cls, valor):
        return valor.strip() if isinstance(valor, str) else valor

class VerificacionRecuperacion(SolicitudRecuperacion):
    codigo: str = Field(pattern=r'^\d{6}$', min_length=6, max_length=6)

class NuevaPassword(SolicitudRecuperacion):
    ticket: str = Field(min_length=40, max_length=100)
    password_nueva: str = Field(min_length=8, max_length=72)

    @field_validator('password_nueva')
    @classmethod
    def validar_password(cls, valor: str) -> str:
        return validar_password_segura(valor)
