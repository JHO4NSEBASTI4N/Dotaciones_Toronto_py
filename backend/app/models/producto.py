from decimal import Decimal
from typing import List, Optional

from sqlalchemy import BigInteger, Boolean, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Producto(Base):
    __tablename__ = "producto"

    id_producto: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    precio: Mapped[Decimal] = mapped_column(Numeric(38, 2), nullable=False)
    talla: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    imagen: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    estado: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    inhabilitado: Mapped[Optional[bool]] = mapped_column(
        Boolean, server_default=text("b'0'"), nullable=True
    )
    categoria: Mapped[Optional[str]] = mapped_column(
        String(100), server_default="General", nullable=True
    )

    inventarios: Mapped[List["Inventario"]] = relationship(
        "Inventario", back_populates="producto"
    )
    alertas_stock: Mapped[List["AlertaStock"]] = relationship(
        "AlertaStock", back_populates="producto"
    )
    descuentos: Mapped[List["Descuento"]] = relationship(
        "Descuento", back_populates="producto"
    )
    detalle_carritos: Mapped[List["DetalleCarrito"]] = relationship(
        "DetalleCarrito", back_populates="producto"
    )
    detalle_pedidos: Mapped[List["DetallePedido"]] = relationship(
        "DetallePedido", back_populates="producto"
    )
    detalle_ventas: Mapped[List["DetalleVenta"]] = relationship(
        "DetalleVenta", back_populates="producto"
    )