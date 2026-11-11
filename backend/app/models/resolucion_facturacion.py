"""Modelo de la resolucion de facturacion (la autorizacion de la DIAN).

La DIAN autoriza a facturar con un **prefijo** y un **rango de numeros**
(del 1 al 5000, por ejemplo) durante una **vigencia**. Ese rango se consume
con un consecutivo, y hay que numerar sin repetir y sin pasarse del rango.

Esta tabla es la que guarda ese permiso. Sin una resolucion vigente no se
puede emitir una factura electronica.
"""

from datetime import date
from typing import Optional

from sqlalchemy import BigInteger, Boolean, Date, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class ResolucionFacturacion(Base):
    __tablename__ = "resolucion_facturacion"

    id_resolucion: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    # "01" = factura de venta. Queda abierto para notas credito (91) / debito (92).
    tipo_documento: Mapped[Optional[str]] = mapped_column(
        String(4), default="01", nullable=True
    )
    numero_resolucion: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    prefijo: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    rango_desde: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    rango_hasta: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    # Ultimo numero usado: el siguiente consecutivo es este + 1.
    consecutivo_actual: Mapped[Optional[int]] = mapped_column(
        BigInteger, nullable=True
    )
    clave_tecnica: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    vigencia_desde: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    vigencia_hasta: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    vigente: Mapped[bool] = mapped_column(
        Boolean, server_default=text("1"), default=True, nullable=False
    )
    notificacion: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
