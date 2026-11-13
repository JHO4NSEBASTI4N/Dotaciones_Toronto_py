"""Schemas del modulo de ventas y facturas.

Una venta **no se crea a mano**: se genera automaticamente cuando un pedido
pasa a "Entregado", copiando los precios que ya estaban congelados en
`detalle_pedido`. Es exactamente lo que hace `generarVentaDesdePedido()`
del proyecto Java: la venta COPIA, no recalcula.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


class DetalleVentaRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_detalle_venta: int
    id_producto: Optional[int] = None
    nombre_producto: Optional[str] = None
    cantidad: int
    precio_lista: Decimal
    descuento_unitario: Decimal
    precio_unitario: Decimal
    subtotal_lista: Decimal
    descuento_total: Decimal
    subtotal: Decimal
    cantidad_devuelta: int = 0


class FacturaRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_factura: int
    id_venta_fk: Optional[int] = None
    total_factura: Decimal
    fecha_factura: Optional[datetime] = None
    estado: str = "Vigente"


class VentaRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_venta: int
    id_usuario_fk: Optional[int] = None
    id_pedido_fk: Optional[int] = None
    fecha_venta: Optional[datetime] = None
    estado: str = "Completada"
    items: list[DetalleVentaRespuesta]
    factura: Optional[FacturaRespuesta] = None
    total_unidades: int
    subtotal_lista: Decimal
    descuento_total: Decimal
    total_pagado: Decimal

    @field_validator("estado", mode="before")
    @classmethod
    def estado_por_defecto(cls, valor: object) -> str:
        return valor or "Completada"


class IngresoPorMes(BaseModel):
    """Datos para la grafica de ingresos por mes del modulo de ventas.

    `periodo` es el formato "YYYY-MM". `ingreso` es la suma de
    `total_pagado` de las ventas Completadas en ese mes.
    """

    periodo: str
    ingreso: Decimal
    ventas: int
