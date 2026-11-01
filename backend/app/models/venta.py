from datetime import datetime
from typing import List, Optional

from sqlalchemy import BigInteger, Float, ForeignKey, String, text
from sqlalchemy.dialects.mysql import DATETIME
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Venta(Base):
    __tablename__ = "venta"

    id_venta: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_usuario_fk: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("usuario.id_usuario"), nullable=True
    )
    id_pedido_fk: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("pedido.id_pedido"), nullable=True
    )
    fecha_venta: Mapped[Optional[datetime]] = mapped_column(DATETIME(fsp=6), nullable=True)
    # OJO: en el dump del proyecto Java esta columna es `double`, no decimal.
    # Se respeta el tipo de la base (la base manda); el redondeo a centavos se
    # hace al construir la respuesta.
    total_pagado: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    estado: Mapped[str] = mapped_column(
        String(50), server_default=text("'Completada'"), default="Completada", nullable=False
    )

    usuario: Mapped[Optional["Usuario"]] = relationship("Usuario", back_populates="ventas")
    pedido: Mapped[Optional["Pedido"]] = relationship("Pedido", back_populates="ventas")
    detalles: Mapped[List["DetalleVenta"]] = relationship(
        "DetalleVenta", back_populates="venta", cascade="all, delete-orphan"
    )
    facturas: Mapped[List["Factura"]] = relationship(
        "Factura", back_populates="venta", cascade="all, delete-orphan"
    )
