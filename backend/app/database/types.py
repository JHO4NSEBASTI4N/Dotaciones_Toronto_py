"""Tipos SQLAlchemy compartidos compatibles con el esquema MySQL existente."""

from sqlalchemy import Integer
from sqlalchemy.dialects.mysql import BIT as MySQLBIT
from sqlalchemy.types import TypeDecorator


class BooleanBit(TypeDecorator[bool]):
    """Lee y escribe BIT(1) sin convertir b'\\x00' en True.

    SQLite usa INTEGER para las pruebas; MySQL conserva BIT(1), compatible con
    las columnas existentes. PyMySQL puede entregar el valor como bytes, por
    lo que la conversión debe hacerse antes de usarlo como booleano Python.
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
