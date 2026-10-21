from datetime import datetime
from typing import List, Optional

from sqlalchemy import BigInteger, Boolean, ForeignKey, String, text
from sqlalchemy.dialects.mysql import DATETIME
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Pedido(Base):
    __tablename__ = "pedido"

    id_pedido: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_usuario_fk: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("usuario.id_usuario"), nullable=True
    )
    fecha_pedido: Mapped[Optional[datetime]] = mapped_column(DATETIME(fsp=6), nullable=True)
    estado: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    oculto: Mapped[Optional[bool]] = mapped_column(
        Boolean, server_default=text("b'0'"), nullable=True
    )

    usuario: Mapped[Optional["Usuario"]] = relationship("Usuario", back_populates="pedidos")
    detalles: Mapped[List["DetallePedido"]] = relationship(
        "DetallePedido", back_populates="pedido", cascade="all, delete-orphan"
    )
    ventas: Mapped[List["Venta"]] = relationship("Venta", back_populates="pedido")
