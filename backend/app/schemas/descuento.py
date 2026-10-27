"""Schemas del catalogo de descuentos.

Decisiones de diseno:

  - `tipo_descuento` se cierra con Literal: en la BD es un varchar(50) libre,
    asi que cualquier texto entraria. Con Literal solo pasan PORCENTAJE y FIJO.
  - El rango del valor depende del tipo: PORCENTAJE va de 0 a 100, FIJO se
    compara contra el precio del producto (eso se valida en el servicio,
    porque aqui no se conoce el precio).
  - `activo` es BIT(1)/tinyint(1) en MySQL: PyMySQL lo devuelve como bytes,
    por eso el validator que lo convierte a booleano.
"""

from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

TipoDescuento = Literal["PORCENTAJE", "FIJO"]


class DescuentoBase(BaseModel):
    id_producto_fk: int = Field(gt=0, description="Producto al que aplica")
    tipo_descuento: TipoDescuento
    valor_descuento: Decimal = Field(gt=0, max_digits=10, decimal_places=2)

    @model_validator(mode="after")
    def validar_rango_porcentaje(self):
        """Un porcentaje mayor a 100 regalaria el producto y ademas lo dejaria negativo."""
        if self.tipo_descuento == "PORCENTAJE" and self.valor_descuento > 100:
            raise ValueError("Un descuento PORCENTAJE no puede ser mayor a 100")
        return self


class DescuentoCrear(DescuentoBase):
    """El descuento nace activo: no se envia `activo` al crear."""


class DescuentoActualizar(BaseModel):
    """Todos los campos opcionales: permite PATCH parcial.

    No valida el rango porcentaje/valor aqui, porque un PATCH puede cambiar
    solo uno de los dos; esa comprobacion se hace en el servicio con los
    valores ya combinados.
    """

    id_producto_fk: Optional[int] = Field(default=None, gt=0)
    tipo_descuento: Optional[TipoDescuento] = None
    valor_descuento: Optional[Decimal] = Field(
        default=None, gt=0, max_digits=10, decimal_places=2
    )

    @field_validator("tipo_descuento", "valor_descuento", "id_producto_fk")
    @classmethod
    def no_aceptar_nulos(cls, valor: object) -> object:
        """`null` explicito no es una actualizacion valida: la columna es obligatoria."""
        if valor is None:
            raise ValueError("El campo no puede ser nulo")
        return valor


class DescuentoRespuesta(DescuentoBase):
    model_config = ConfigDict(from_attributes=True)

    id_descuento: int
    activo: bool = True

    @field_validator("activo", mode="before")
    @classmethod
    def convertir_bit_a_booleano(cls, valor: object) -> bool:
        """En MySQL esas columnas son BIT(1) y PyMySQL las devuelve como bytes."""
        if isinstance(valor, (bytes, bytearray)):
            return valor != b"\x00"
        return bool(valor)
