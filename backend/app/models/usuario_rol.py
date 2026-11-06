from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

class UsuarioRol(Base):
    __tablename__ = "usuario_rol"
    __table_args__ = (
        UniqueConstraint("id_usuario_fk", "id_rol_fk", name="uk_usuario_rol"),
    )
    
    id_usuario_rol: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_usuario_fk: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("usuario.id_usuario", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    id_rol_fk: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("rol.id_rol", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    # La base trae `activo tinyint(1) NOT NULL DEFAULT 1`.
    # Quitarle un rol a un usuario es poner esto en 0, NUNCA borrar la fila:
    # asi queda el historial de que alguna vez tuvo ese rol.
    activo: Mapped[bool] = mapped_column(
        Boolean, server_default=text("1"), default=True, nullable=False
    )

    usuario: Mapped["Usuario"] = relationship("Usuario", back_populates="usuario_roles")
    rol: Mapped["Rol"] = relationship("Rol", back_populates="usuario_roles")
