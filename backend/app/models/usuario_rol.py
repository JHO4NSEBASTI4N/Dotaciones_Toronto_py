from sqlalchemy import BigInteger, ForeignKey, Integer, UniqueConstraint
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
    usuario: Mapped["Usuario"] = relationship("Usuario", back_populates="usuario_roles")
    rol: Mapped["Rol"] = relationship("Rol", back_populates="usuario_roles")