"""Excepciones de dominio y sus handlers HTTP.

Los servicios lanzan estas excepciones (sin conocer FastAPI); main.py las
traduce a respuestas HTTP. Asi la logica de negocio es reutilizable fuera de
la API (scripts, tareas, tests).
"""

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


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


def registrar_manejadores(app: FastAPI) -> None:
    """Conecta las excepciones de dominio con respuestas JSON uniformes."""

    @app.exception_handler(ErrorDominio)
    async def manejador_error_dominio(request: Request, exc: ErrorDominio):
        return JSONResponse(
            status_code=exc.codigo_http,
            content={"error": type(exc).__name__, "detalle": exc.detalle},
        )
