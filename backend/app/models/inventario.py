from typing import Optional

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Inventario(Base):
    __tablename__ = "inventario"

    id_inventario: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_producto_fk: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("producto.id_producto"), nullable=True
    )
    cantidad_actual: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    stock_minimo: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    inhabilitado: Mapped[Optional[bool]] = mapped_column(
        Boolean, server_default=text("b'0'"), nullable=True
    )

    producto: Mapped[Optional["Producto"]] = relationship(
        "Producto", back_populates="inventarios"
    )
