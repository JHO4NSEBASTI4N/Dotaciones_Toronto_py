"""Paginacion reutilizable: parametros de entrada y respuesta envolvente."""

from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel

T = TypeVar("T")

LIMITE_POR_DEFECTO = 20
LIMITE_MAXIMO = 100


class ParametrosPaginacion:
    """Se inyecta con Depends(ParametrosPaginacion)."""

    def __init__(
        self,
        saltar: int = Query(0, ge=0, description="Registros a omitir"),
        limite: int = Query(
            LIMITE_POR_DEFECTO,
            ge=1,
            le=LIMITE_MAXIMO,
            description=f"Cuantos registros devolver (max {LIMITE_MAXIMO})",
        ),
    ) -> None:
        self.saltar = saltar
        self.limite = limite


class PaginaRespuesta(BaseModel, Generic[T]):
    """Envoltorio uniforme para listados paginados."""

    total: int
    saltar: int
    limite: int
    items: list[T]
