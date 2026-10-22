from decimal import Decimal
from typing import Optional

from sqlalchemy import BigInteger, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class DetallePedido(Base):
    __tablename__ = "detalle_pedido"

    id_detalle_pedido: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_pedido_fk: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("pedido.id_pedido"), nullable=True
    )
    id_producto_fk: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("producto.id_producto"), nullable=True
    )
    precio_unitario: Mapped[Optional[Decimal]] = mapped_column(Numeric(38, 2), nullable=True)
    cantidad: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    pedido: Mapped[Optional["Pedido"]] = relationship("Pedido", back_populates="detalles")
    producto: Mapped[Optional["Producto"]] = relationship(
        "Producto", back_populates="detalle_pedidos"
    )
