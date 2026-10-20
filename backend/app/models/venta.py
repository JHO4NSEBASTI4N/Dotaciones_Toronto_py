from datetime import datetime
from typing import List, Optional
from sqlalchemy import BigInteger, Float, ForeignKey
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
    total_pagado: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    usuario: Mapped[Optional["Usuario"]] = relationship("Usuario", back_populates="ventas")
    pedido: Mapped[Optional["Pedido"]] = relationship("Pedido", back_populates="ventas")
    detalles: Mapped[List["DetalleVenta"]] = relationship(
        "DetalleVenta", back_populates="venta", cascade="all, delete-orphan"
    )
    facturas: Mapped[List["Factura"]] = relationship(
        "Factura", back_populates="venta", cascade="all, delete-orphan"
    )
