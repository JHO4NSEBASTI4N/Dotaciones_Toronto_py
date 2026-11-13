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
            # PyMySQL normalmente entrega BIT(1) como b"\x00" / b"\x01".
            # Algunos controladores o datos migrados lo entregan como b"0" / b"1".
            try:
                texto = bytes(valor).decode("ascii").strip()
                if texto in {"0", "1"}:
                    return texto == "1"
            except UnicodeDecodeError:
                pass
            return any(valor)
        if isinstance(valor, str):
            texto = valor.strip().lower()
            if texto in {"0", "false", "f", "no", "n", ""}:
                return False
            if texto in {"1", "true", "t", "yes", "s"}:
                return True
        return bool(valor)