"""Excepciones de dominio y sus handlers HTTP.

Los servicios lanzan estas excepciones (sin conocer FastAPI); main.py las
traduce a respuestas HTTP. Asi la logica de negocio es reutilizable fuera de
la API (scripts, tareas, tests).
"""

import logging

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError

logger = logging.getLogger(__name__)


class ErrorDominio(Exception):
    """Base de todos los errores de negocio."""

    mensaje = "Error de negocio"
    codigo_http = status.HTTP_400_BAD_REQUEST

    def __init__(self, mensaje: str | None = None) -> None:
        super().__init__(mensaje or self.mensaje)
        self.detalle = mensaje or self.mensaje


class NoEncontrado(ErrorDominio):
    mensaje = "Recurso no encontrado"
    codigo_http = status.HTTP_404_NOT_FOUND


class Conflicto(ErrorDominio):
    mensaje = "El recurso ya existe"
    codigo_http = status.HTTP_409_CONFLICT


class NoAutorizado(ErrorDominio):
    mensaje = "Credenciales invalidas"
    codigo_http = status.HTTP_401_UNAUTHORIZED


class Prohibido(ErrorDominio):
    mensaje = "No tiene permisos para esta operacion"
    codigo_http = status.HTTP_403_FORBIDDEN


class ReglaNegocio(ErrorDominio):
    mensaje = "La operacion viola una regla de negocio"
    codigo_http = status.HTTP_400_BAD_REQUEST


class ServicioNoDisponible(ErrorDominio):
    """La base de datos no responde (MySQL apagado, puerto cerrado, etc.)."""

    mensaje = "La base de datos no esta disponible"
    codigo_http = status.HTTP_503_SERVICE_UNAVAILABLE


def registrar_manejadores(app: FastAPI) -> None:
    """Conecta las excepciones de dominio con respuestas JSON uniformes."""

    @app.exception_handler(ErrorDominio)
    async def manejador_error_dominio(request: Request, exc: ErrorDominio):
        return JSONResponse(
            status_code=exc.codigo_http,
            content={"error": type(exc).__name__, "detalle": exc.detalle},
        )

    @app.exception_handler(OperationalError)
    async def manejador_bd_caida(request: Request, exc: OperationalError):
        """Sin esto, MySQL apagado devuelve un 500 con traceback completo.

        Con esto, el cliente recibe un 503 claro y el detalle queda en el log.
        """
        logger.exception("Fallo de conexion con la base de datos")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "error": "ServicioNoDisponible",
                "detalle": "No se pudo conectar con la base de datos. Verifica "
                "que MySQL este encendido y que DATABASE_URL sea correcta.",
            },
        )