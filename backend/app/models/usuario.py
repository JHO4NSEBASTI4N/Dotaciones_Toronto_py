from typing import List, Optional
from sqlalchemy import BigInteger, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

class Usuario(Base):
    __tablename__ = "usuario"
    
    id_usuario: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    documento: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    correo: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    telefono: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    direccion: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    estado: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    id_rol_fk: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("rol.id_rol"), default=2, nullable=True
    )
    
    
    rol: Mapped[Optional["Rol"]] = relationship("Rol", back_populates="usuarios")
    usuario_roles: Mapped[List["UsuarioRol"]] = relationship(
        "UsuarioRol", back_populates="usuario", cascade="all, delete-orphan"
    )
    pedidos: Mapped[List["Pedido"]] = relationship("Pedido", back_populates="usuario")
    ventas: Mapped[List["Venta"]] = relationship("Venta", back_populates="usuario")
    carritos: Mapped[List["Carrito"]] = relationship("Carrito", back_populates="usuario")
