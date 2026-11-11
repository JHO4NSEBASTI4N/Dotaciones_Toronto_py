"""Modelo de las lineas de la factura electronica.

Una fila por producto facturado. Guarda el IVA de cada linea porque la DIAN
lo pide linea por linea en el XML (no solo el total).
"""

from decimal import Decimal
from typing import Optional

from sqlalchemy import BigInteger, ForeignKey, Integer, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class FacturaElectronicaDetalle(Base):
    __tablename__ = "factura_electronica_detalle"

    id_detalle_factura: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    id_factura_fk: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("factura_electronica.id_factura"), nullable=False
    )
    numero_linea: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    codigo_producto: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    descripcion: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    cantidad: Mapped[Optional[Decimal]] = mapped_column(Numeric(19, 2), nullable=True)
    # "94" = unidad (catalogo de la DIAN). Es lo que usa el dump.
    unidad_medida: Mapped[Optional[str]] = mapped_column(
        String(6), default="94", nullable=True
    )
    precio_unitario: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(19, 2), nullable=True
    )
    descuento: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(19, 2), server_default=text("0.00"), default=Decimal("0.00")
    )
    iva_porcentaje: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2), server_default=text("0.00"), default=Decimal("0.00")
    )
    iva_valor: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(19, 2), server_default=text("0.00"), default=Decimal("0.00")
    )
    total_linea: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(19, 2), server_default=text("0.00"), default=Decimal("0.00")
    )

    factura: Mapped["FacturaElectronica"] = relationship(
        "FacturaElectronica", back_populates="lineas"
    )
