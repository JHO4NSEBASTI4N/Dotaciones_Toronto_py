"""Consulta de contactos y respuestas: solo rol Administrador."""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, field_validator

from app.core.dependencies import ROL_ADMINISTRADOR, requiere_rol
from app.services import correos_admin as servicio

router = APIRouter(dependencies=[Depends(requiere_rol(ROL_ADMINISTRADOR))])


class RespuestaCorreo(BaseModel):
    uids: list[int] = Field(min_length=1, max_length=25)
    uidvalidity: int = Field(gt=0)
    asunto: str = Field(min_length=1, max_length=180)
    mensaje: str = Field(min_length=1, max_length=5000)

    @field_validator('uids')
    @classmethod
    def ids_validos(cls, valor):
        if any(uid <= 0 or uid > 4294967295 for uid in valor) or len(set(valor)) != len(valor):
            raise ValueError('Identificadores de mensajes inválidos o duplicados.')
        return valor

    @field_validator('asunto', 'mensaje')
    @classmethod
    def texto_valido(cls, valor, info):
        valor = valor.strip()
        if not valor or '\x00' in valor or (info.field_name == 'asunto' and ('\n' in valor or '\r' in valor)):
            raise ValueError('El texto no es válido.')
        return valor


@router.get('')
def listar(antes: int | None = Query(default=None, gt=0, le=4294967295)):
    return servicio.listar(antes)


@router.post('/responder')
def responder(datos: RespuestaCorreo):
    return servicio.responder(datos.uids, datos.uidvalidity, datos.asunto, datos.mensaje)
