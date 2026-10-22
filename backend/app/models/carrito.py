from datetime import date
from typing import List, Optional

from sqlalchemy import BigInteger, Date, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Carrito(Base):
    __tablename__ = "carrito"

    id_carrito: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_usuario_fk: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("usuario.id_usuario"), nullable=True
    )
    fecha_creacion: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    usuario: Mapped[Optional["Usuario"]] = relationship("Usuario", back_populates="carritos")
    detalles: Mapped[List["DetalleCarrito"]] = relationship(
        "DetalleCarrito", back_populates="carrito", cascade="all, delete-orphan"
    )
