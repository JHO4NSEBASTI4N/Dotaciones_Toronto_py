from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

TipoMovimiento = Literal["ENTRADA", "SALIDA", "AJUSTE"]


class _BitABooleano(BaseModel):
    @field_validator("inhabilitado", mode="before", check_fields=False)
    @classmethod
    def convertir_bit(cls, valor: object) -> bool:
        if isinstance(valor, (bytes, bytearray)):
            return valor != b"\x00"
        return bool(valor)


class InventarioRespuesta(_BitABooleano):
    model_config = ConfigDict(from_attributes=True)

    id_inventario: int
    id_producto_fk: Optional[int] = None
    cantidad_actual: Optional[int] = None
    stock_minimo: Optional[int] = None
    inhabilitado: bool = False


class StockPorProducto(_BitABooleano):
    """Vista agregada: suma el stock de todas las filas del producto.

    El dump tiene filas repetidas para un mismo producto (id 13 e 18 para el
    producto 10), asi que se suma para no reportar un stock a medias.
    """

    id_producto: int
    nombre: str
    categoria: Optional[str] = None
    talla: Optional[str] = None
    color: Optional[str] = None
    stock_total: int
    stock_minimo: int
    bajo_minimo: bool
    filas_inventario: int
    inhabilitado: bool = False


class InventarioCrear(BaseModel):
    id_producto_fk: int
    cantidad_actual: int = Field(default=0, ge=0)
    stock_minimo: int = Field(default=0, ge=0)


class InventarioActualizar(BaseModel):
    stock_minimo: Optional[int] = Field(default=None, ge=0)


class _MovimientoBase(BaseModel):
    cantidad: int = Field(gt=0, description="Cantidad positiva; el tipo define el signo")
    motivo: Optional[str] = Field(default=None, max_length=255)


class EntradaStock(_MovimientoBase):
    """Suma stock."""


class SalidaStock(_MovimientoBase):
    """Resta stock; falla si no alcanza."""


class AjusteStock(BaseModel):
    """Fija el stock en un valor absoluto (conteo fisico)."""

    cantidad_actual: int = Field(ge=0)
    motivo: Optional[str] = Field(default=None, max_length=255)


class MovimientoRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_inventario: Optional[int] = None
    nombre_producto: Optional[str] = None
    tipo_movimiento: Optional[str] = None
    cantidad: Optional[int] = None
    motivo: Optional[str] = None
    usuario_responsable: Optional[str] = None
    fecha_hora: Optional[datetime] = None


class AlertaStockRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_alerta: int
    id_producto_fk: Optional[int] = None
    nivel_stock: Optional[int] = None
    fecha_alerta: Optional[object] = None