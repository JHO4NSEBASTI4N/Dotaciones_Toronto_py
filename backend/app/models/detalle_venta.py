from decimal import Decimal
from typing import List, Optional

from sqlalchemy import BigInteger, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class DetalleVenta(Base):
    __tablename__ = "detalle_venta"

    id_detalle_venta: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_venta_fk: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("venta.id_venta"), nullable=True
    )
    id_producto_fk: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("producto.id_producto"), nullable=True
    )
    cantidad: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    precio_unitario: Mapped[Optional[Decimal]] = mapped_column(Numeric(38, 2), nullable=True)

    venta: Mapped[Optional["Venta"]] = relationship("Venta", back_populates="detalles")
    producto: Mapped[Optional["Producto"]] = relationship(
        "Producto", back_populates="detalle_ventas"
    )
    devoluciones: Mapped[List["Devolucion"]] = relationship(
        "Devolucion", back_populates="detalle_venta", cascade="all, delete-orphan"
    )
