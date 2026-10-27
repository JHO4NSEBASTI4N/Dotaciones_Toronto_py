from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProductoBase(BaseModel):
    nombre: str = Field(min_length=2, max_length=255)
    precio: Decimal = Field(gt=0, max_digits=38, decimal_places=2)
    talla: Optional[str] = Field(default=None, max_length=255)
    color: Optional[str] = Field(default=None, max_length=255)
    imagen: Optional[str] = Field(default=None, max_length=255)
    categoria: str = Field(default="General", max_length=100)


class ProductoCrear(ProductoBase):
    """No incluye id_producto, estado ni inhabilitado: los pone el servidor."""


class ProductoActualizar(BaseModel):
    """Todos los campos opcionales: permite PATCH parcial."""

    nombre: Optional[str] = Field(default=None, min_length=2, max_length=255)
    precio: Optional[Decimal] = Field(default=None, gt=0, max_digits=38, decimal_places=2)
    talla: Optional[str] = Field(default=None, max_length=255)
    color: Optional[str] = Field(default=None, max_length=255)
    imagen: Optional[str] = Field(default=None, max_length=255)
    categoria: Optional[str] = Field(default=None, max_length=100)


class ProductoRespuesta(ProductoBase):
    model_config = ConfigDict(from_attributes=True)

    id_producto: int
    estado: Optional[str] = None
    inhabilitado: bool = False

    @field_validator("inhabilitado", mode="before")
    @classmethod
    def convertir_bit_a_booleano(cls, valor: object) -> bool:
        """En MySQL esas columnas son BIT(1) y PyMySQL las devuelve como bytes.

        Sin esto, bool(b"\\x00") es True en Python: un producto inhabilitado
        se leeria como habilitado. Aqui se interpreta el byte correctamente.
        """
        if isinstance(valor, (bytes, bytearray)):
            return valor != b"\x00"
        return bool(valor)