from typing import List, Optional

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Rol(Base):
    __tablename__ = "rol"

    id_rol: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre_rol: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    descripcion_rol: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)

    usuarios: Mapped[List["Usuario"]] = relationship(
        "Usuario", back_populates="rol"
    )
    usuario_roles: Mapped[List["UsuarioRol"]] = relationship(
        "UsuarioRol", back_populates="rol", cascade="all, delete-orphan"
    )
