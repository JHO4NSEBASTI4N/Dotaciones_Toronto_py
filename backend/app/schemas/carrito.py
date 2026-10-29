from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

CANTIDAD_MINIMA = 1
CANTIDAD_MAXIMA = 999


class ItemCarritoCrear(BaseModel):
    id_producto: int = Field(gt=0)
    cantidad: int = Field(default=1, ge=CANTIDAD_MINIMA, le=CANTIDAD_MAXIMA)


class ItemCarritoActualizar(BaseModel):
    cantidad: int = Field(ge=CANTIDAD_MINIMA, le=CANTIDAD_MAXIMA)


class ItemCarritoRespuesta(BaseModel):
    """Una linea del carrito, ya con el descuento aplicado."""

    id_detalle_carrito: int
    id_producto: int
    nombre: str
    talla: Optional[str] = None
    color: Optional[str] = None
    imagen: Optional[str] = None
    cantidad: int
    precio_lista: Decimal
    descuento_unitario: Decimal
    precio_unitario: Decimal
    subtotal_lista: Decimal
    descuento_total: Decimal
    subtotal: Decimal
    stock_disponible: Optional[int] = None


class CarritoRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_carrito: int
    fecha_creacion: Optional[date] = None
    items: list[ItemCarritoRespuesta]
    total_unidades: int
    subtotal_lista: Decimal
    descuento_total: Decimal
    total: Decimal