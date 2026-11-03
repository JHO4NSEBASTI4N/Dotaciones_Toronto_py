from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, field_validator
EstadoPedido = Literal['Pendiente', 'Enviado', 'Entregado', 'Cancelado']
TRANSICIONES: dict[str, set[str]] = {'Pendiente': {'Enviado', 'Cancelado'}, 'Enviado': {'Entregado', 'Cancelado'}, 'Entregado': set(), 'Cancelado': set()}

class PedidoEstadoActualizar(BaseModel):
    estado: EstadoPedido

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
