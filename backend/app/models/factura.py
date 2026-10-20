from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Factura(Base):
    __tablename__ = "factura"

    id_factura: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_venta_fk: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("venta.id_venta"), nullable=True
    )
    total_factura: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    fecha_factura: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    venta: Mapped[Optional["Venta"]] = relationship("Venta", back_populates="facturas")
