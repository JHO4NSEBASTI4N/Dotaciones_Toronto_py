from decimal import Decimal
from typing import Optional

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Descuento(Base):
    __tablename__ = "descuento"

    id_descuento: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_producto_fk: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("producto.id_producto"), nullable=True
    )
    tipo_descuento: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    valor_descuento: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    activo: Mapped[bool] = mapped_column(
        Boolean, server_default=text("1"), default=True, nullable=False
    )

    producto: Mapped[Optional["Producto"]] = relationship(
        "Producto", back_populates="descuentos"
    )
