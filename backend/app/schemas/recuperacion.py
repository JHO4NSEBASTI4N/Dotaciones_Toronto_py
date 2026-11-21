from pydantic import BaseModel, EmailStr, Field, field_validator

class SolicitudRecuperacion(BaseModel):
    correo: EmailStr

class VerificacionRecuperacion(SolicitudRecuperacion):
    codigo: str = Field(pattern=r'^\d{6}$', min_length=6, max_length=6)

class NuevaPassword(SolicitudRecuperacion):
    ticket: str = Field(min_length=40, max_length=100)
    password_nueva: str = Field(min_length=8, max_length=72)

    @field_validator('password_nueva')
    @classmethod
    def verificar_bytes(cls, valor: str) -> str:
        if len(valor.encode('utf-8')) > 72:
            raise ValueError('La contraseña no debe superar 72 bytes en UTF-8')
        return valor
