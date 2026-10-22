from datetime import date
from typing import Optional

from sqlalchemy import BigInteger, Date, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class AlertaStock(Base):
    __tablename__ = "alerta_stock"

    id_alerta: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_producto_fk: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("producto.id_producto"), nullable=True
    )
    nivel_stock: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fecha_alerta: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    producto: Mapped[Optional["Producto"]] = relationship(
        "Producto", back_populates="alertas_stock"
    )
