from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class MovimientoInventario(Base):
    """Historial de movimientos de inventario (ENTRADA / SALIDA / AJUSTE).

    Nota: en el dump no existe una FK declarada entre
    `movimientos_inventario.id_inventario` e `inventario.id_inventario`
    (no aparece en la sección `ADD CONSTRAINT`), por lo que se mapea como
    una columna simple, sin `relationship`.
    """

    __tablename__ = "movimientos_inventario"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_inventario: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    nombre_producto: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    tipo_movimiento: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    cantidad: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    motivo: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    usuario_responsable: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    fecha_hora: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
