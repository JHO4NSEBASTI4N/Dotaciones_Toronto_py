from decimal import Decimal
from typing import List, Optional

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, Numeric, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class DetalleVenta(Base):
    _tablename_ = "detalle_venta"

    id_detalle_venta: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_venta_fk: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("venta.id_venta"), nullable=True
    )
    id_producto_fk: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("producto.id_producto"), nullable=True
    )
    cantidad: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # precio_unitario es el precio FINAL pagado (ya con descuento).
    precio_unitario: Mapped[Optional[Decimal]] = mapped_column(Numeric(38, 2), nullable=True)
    inhabilitado: Mapped[bool] = mapped_column(
        Boolean, server_default=text("0"), default=False, nullable=False
    )
    # Foto del descuento, copiada del pedido (no se recalcula nunca).
    precio_lista: Mapped[Optional[Decimal]] = mapped_column(Numeric(38, 2), nullable=True)
    descuento_unitario: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(38, 2), server_default=text("0.00"), default=Decimal("0.00"), nullable=False
    )

    venta: Mapped[Optional["Venta"]] = relationship("Venta", back_populates="detalles")
    producto: Mapped[Optional["Producto"]] = relationship(
        "Producto", back_populates="detalle_ventas"
    )
    devoluciones: Mapped[List["Devolucion"]] = relationship(
        "Devolucion", back_populates="detalle_venta"
    )