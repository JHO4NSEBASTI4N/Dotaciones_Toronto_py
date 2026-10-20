from datetime import date
from typing import Optional

from sqlalchemy import BigInteger, Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Devolucion(Base):
    __tablename__ = "devolucion"

    id_devolucion: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_detalle_venta_fk: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("detalle_venta.id_detalle_venta"), nullable=True
    )
    cantidad: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    motivo: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    fecha_devolucion: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    estado: Mapped[Optional[str]] = mapped_column(
        String(255), default="Pendiente", nullable=True
    )

    detalle_venta: Mapped[Optional["DetalleVenta"]] = relationship(
        "DetalleVenta", back_populates="devoluciones"
    )
