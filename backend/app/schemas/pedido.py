from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
EstadoPedido = Literal['Pendiente', 'Enviado', 'Entregado', 'Cancelado']
TRANSICIONES: dict[str, set[str]] = {
    'Pendiente': {'Enviado', 'Entregado', 'Cancelado'},
    'Enviado': {'Pendiente', 'Entregado', 'Cancelado'},
    'Entregado': {'Pendiente', 'Enviado'},
    'Cancelado': set(),
}

class PedidoEstadoActualizar(BaseModel):
    estado: EstadoPedido
    # Metodos de pago registrados al entregar el pedido (genera la venta).
    # Opcional: si no viene, la venta queda sin metodo (reportes lo muestran
    # como "Sin especificar").
    metodo_pago: Optional[str] = Field(default=None, max_length=50)

    @field_validator("metodo_pago", mode="before")
    @classmethod
    def limpiar_metodo_pago(cls, valor: object) -> object:
        if isinstance(valor, str):
            return " ".join(valor.split()) or None
        return valor

class ItemPedidoActualizar(BaseModel):
    id_producto: int = Field(gt=0)
    cantidad: int = Field(gt=0, le=10000)


class PedidoItemsActualizar(BaseModel):
    """Lista final de productos/cantidades de un pedido pendiente."""

    items: list[ItemPedidoActualizar] = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def validar_productos_unicos(self):
        ids = [item.id_producto for item in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("No se puede repetir un producto en el pedido")
        return self


class ItemPedidoRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_detalle_pedido: int
    id_producto: Optional[int] = None
    nombre_producto: Optional[str] = None
    cantidad: int
    precio_lista: Decimal
    descuento_unitario: Decimal
    precio_unitario: Decimal
    subtotal_lista: Decimal
    descuento_total: Decimal
    subtotal: Decimal

class PedidoRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_pedido: int
    id_usuario_fk: Optional[int] = None
    fecha_pedido: Optional[datetime] = None
    estado: Optional[str] = None
    oculto: bool = False
    items: list[ItemPedidoRespuesta]
    total_unidades: int
    subtotal_lista: Decimal
    descuento_total: Decimal
    total: Decimal

    @field_validator('oculto', mode='before')
    @classmethod
    def convertir_bit_a_booleano(cls, valor: object) -> bool:
        if isinstance(valor, (bytes, bytearray)):
            return valor != b'\x00'
        return bool(valor)
