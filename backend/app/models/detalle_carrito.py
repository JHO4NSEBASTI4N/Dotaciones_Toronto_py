from typing import Optional

from sqlalchemy import BigInteger, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class DetalleCarrito(Base):
    __tablename__ = "detalle_carrito"

    id_detalle_carrito: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_carrito_fk: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("carrito.id_carrito"), nullable=True
    )
    id_producto_fk: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("producto.id_producto"), nullable=True
    )
    cantidad: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    carrito: Mapped[Optional["Carrito"]] = relationship("Carrito", back_populates="detalles")
    producto: Mapped[Optional["Producto"]] = relationship(
        "Producto", back_populates="detalle_carritos"
    )
