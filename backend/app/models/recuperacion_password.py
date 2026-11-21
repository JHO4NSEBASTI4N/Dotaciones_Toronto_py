from datetime import datetime
from typing import Optional
from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base

class RecuperacionPassword(Base):
    __tablename__ = 'recuperacion_password'
    id_usuario_fk: Mapped[int] = mapped_column(BigInteger, ForeignKey('usuario.id_usuario', ondelete='CASCADE'), primary_key=True)
    codigo_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    ticket_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    password_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expira_en: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    intentos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bloqueado_hasta: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
