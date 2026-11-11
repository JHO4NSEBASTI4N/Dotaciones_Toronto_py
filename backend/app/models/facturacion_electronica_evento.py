"""Modelo de la bitacora de eventos de la factura electronica.

Cada paso del proceso deja su fila: generacion, firma, envio, respuesta de la
DIAN, anulacion. Sirve para responder "¿que le paso a este documento?" sin
tener que adivinar, y es lo que suele pedir una auditoria.

`payload` guarda el JSON crudo de lo que respondio la DIAN (util cuando algo
falla).
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class FacturaElectronicaEvento(Base):
    __tablename__ = "factura_electronica_evento"

    id_evento: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    id_factura_fk: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("factura_electronica.id_factura"), nullable=False
    )
    fecha: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    # GENERACION | FIRMA | ENVIO | RESPUESTA | ANULACION
    tipo: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    estado: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    mensaje: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    factura: Mapped["FacturaElectronica"] = relationship(
        "FacturaElectronica", back_populates="eventos"
    )
