from decimal import Decimal
from typing import List, Optional

from sqlalchemy import BigInteger, Integer, Numeric, String, text
from sqlalchemy.dialects.mysql import BIT as MySQLBIT
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.database.base import Base


class BooleanBit(TypeDecorator[bool]):
    """Boolean compatible con la columna MySQL BIT(1) de la BD existente.

    SQLAlchemy convierte bytes a bool antes de que Pydantic los valide si el
    modelo usa `Boolean`: bool(b"\\x00") vale True y deja todo habilitado como
    si estuviera inhabilitado. Aquí se conserva BIT en MySQL y se normaliza
    su valor al leerlo; SQLite usa INTEGER para las pruebas.
    """

    impl = Integer
    cache_ok = True

    def load_dialect_impl(self, dialect):
        tipo = MySQLBIT(1) if dialect.name == "mysql" else Integer()
        return dialect.type_descriptor(tipo)

    def process_bind_param(self, valor, dialect):
        if valor is None:
            return None
        return 1 if self._a_booleano(valor) else 0

    def process_result_value(self, valor, dialect):
        if valor is None:
            return None
        return self._a_booleano(valor)

    @staticmethod
    def _a_booleano(valor) -> bool:
        if isinstance(valor, (bytes, bytearray)):
            try:
                texto = bytes(valor).decode("ascii").strip()
                if texto in {"0", "1"}:
                    return texto == "1"
            except UnicodeDecodeError:
                pass
            return any(valor)
        if isinstance(valor, str):
            texto = valor.strip().lower()
            if texto in {"0", "false", "f", "no", "n", ""}:
                return False
            if texto in {"1", "true", "t", "yes", "s"}:
                return True
        return bool(valor)


class Producto(Base):
    __tablename__ = "producto"

    id_producto: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    precio: Mapped[Decimal] = mapped_column(Numeric(38, 2), nullable=False)
    talla: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    imagen: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    estado: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    inhabilitado: Mapped[Optional[bool]] = mapped_column(
        BooleanBit(), server_default=text("b'0'"), nullable=True
    )
    categoria: Mapped[Optional[str]] = mapped_column(
        String(100), server_default="General", nullable=True
    )

    inventarios: Mapped[List["Inventario"]] = relationship(
        "Inventario", back_populates="producto"
    )
    alertas_stock: Mapped[List["AlertaStock"]] = relationship(
        "AlertaStock", back_populates="producto"
    )
    descuentos: Mapped[List["Descuento"]] = relationship(
        "Descuento", back_populates="producto"
    )
    detalle_carritos: Mapped[List["DetalleCarrito"]] = relationship(
        "DetalleCarrito", back_populates="producto"
    )
    detalle_pedidos: Mapped[List["DetallePedido"]] = relationship(
        "DetallePedido", back_populates="producto"
    )
    detalle_ventas: Mapped[List["DetalleVenta"]] = relationship(
        "DetalleVenta", back_populates="producto"
    )