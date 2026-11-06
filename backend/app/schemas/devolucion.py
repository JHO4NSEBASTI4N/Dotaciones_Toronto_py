from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Los tres estados posibles. 'Pendiente' es el inicial, los otros dos son finales.
ESTADO_PENDIENTE = "Pendiente"
ESTADO_APROBADA = "Aprobada"
ESTADO_RECHAZADA = "Rechazada"

ESTADOS_VALIDOS = {ESTADO_PENDIENTE, ESTADO_APROBADA, ESTADO_RECHAZADA}


class DevolucionCrear(BaseModel):
    """Lo que envia el cliente para pedir una devolucion."""

    id_detalle_venta: int = Field(
        gt=0, description="Linea de la venta sobre la que se devuelve"
    )
    cantidad: int = Field(
        gt=0, description="Cuantas unidades se devuelven (maximo lo vendido en esa linea)"
    )
    motivo: str = Field(
        min_length=5,
        max_length=255,
        description="Por que se devuelve. Obligatorio: queda en el historial",
    )

    @field_validator("motivo")
    @classmethod
    def motivo_sin_espacios_de_mas(cls, valor: str) -> str:
        limpio = " ".join(valor.split())
        if len(limpio) < 5:
            raise ValueError("El motivo debe describir la razon de la devolucion")
        return limpio


class DevolucionEstadoActualizar(BaseModel):
    """Cambio de estado. Solo se puede resolver una vez."""

    estado: str = Field(description="Aprobada o Rechazada")
    observacion: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Nota interna de quien aprueba o rechaza (no se muestra al cliente)",
    )

    @field_validator("estado", mode="before")
    @classmethod
    def normalizar_estado(cls, valor: object) -> object:
        if isinstance(valor, str):
            return valor.strip().capitalize()
        return valor

    @field_validator("estado")
    @classmethod
    def estado_permitido(cls, valor: str) -> str:
        if valor not in (ESTADO_APROBADA, ESTADO_RECHAZADA):
            raise ValueError(
                f"El estado debe ser '{ESTADO_APROBADA}' o '{ESTADO_RECHAZADA}'"
            )
        return valor


class DevolucionRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_devolucion: int
    id_detalle_venta_fk: Optional[int] = None
    cantidad: int
    motivo: Optional[str] = None
    fecha_devolucion: Optional[date] = None
    estado: str = ESTADO_PENDIENTE

    # Datos de contexto para que el cliente entienda la devolucion sin
    # tener que consultar la venta por aparte.
    id_venta: Optional[int] = None
    id_producto: Optional[int] = None
    nombre_producto: Optional[str] = None
    cantidad_vendida: Optional[int] = None
    cantidad_devuelta: Optional[int] = None
    cantidad_disponible: Optional[int] = None
    valor_unitario: Optional[str] = None
    valor_devuelto: Optional[str] = None

    @field_validator("estado", mode="before")
    @classmethod
    def estado_por_defecto(cls, valor: object) -> str:
        return valor or ESTADO_PENDIENTE

    @field_validator("cantidad", mode="before")
    @classmethod
    def cantidad_por_defecto(cls, valor: object) -> int:
        return valor or 0