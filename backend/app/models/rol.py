from typing import List, Optional

from sqlalchemy import Boolean, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Rol(Base):
    __tablename__ = "rol"

    id_rol: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre_rol: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    descripcion_rol: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    # La base trae `activo tinyint(1) NOT NULL DEFAULT 1`. Un rol no se borra:
    # se desactiva, y deja de poder usarse para iniciar sesion.
    activo: Mapped[bool] = mapped_column(
        Boolean, server_default=text("1"), default=True, nullable=False
    )

    usuarios: Mapped[List["Usuario"]] = relationship(
        "Usuario", back_populates="rol"
    )
    usuario_roles: Mapped[List["UsuarioRol"]] = relationship(
        "UsuarioRol", back_populates="rol", cascade="all, delete-orphan"
    )
