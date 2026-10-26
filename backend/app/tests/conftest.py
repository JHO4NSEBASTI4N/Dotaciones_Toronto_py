"""Fixtures de pytest: BD en memoria, sesion aislada y cliente HTTP.

Se usa StaticPool para que todas las conexiones compartan la misma base
en memoria (si no, cada conexion crea una BD nueva y vacia).
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import BigInteger, Integer, Table, create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models as modelos  # noqa: F401  (registra los 15 modelos)
from app.database.base import Base
from app.database.connection import obtener_sesion
from app.main import app as aplicacion


# SQLite solo auto-incrementa columnas INTEGER PRIMARY KEY, no BIGINT.
# Este listener traduce las PK BIGINT a INTEGER solo para el motor SQLite de
# pruebas, sin tocar los modelos (que siguen siendo BIGINT en MySQL).
@event.listens_for(Table, "before_create")
def _adaptar_tablas_a_sqlite(tabla, conexion, **kw):
    """Dos ajustes solo para el SQLite de pruebas:

    1. SQLite solo auto-incrementa INTEGER PRIMARY KEY, no BIGINT.
    2. Los server_default b'0' de MySQL no son SQL valido en SQLite.
    Los modelos NO se tocan: en MySQL siguen siendo BIGINT y BIT(1).
    """
    if conexion.dialect.name != "sqlite":
        return
    for columna in tabla.primary_key.columns:
        if isinstance(columna.type, BigInteger):
            columna.type = Integer()
    for columna in tabla.columns:
        columna.server_default = None


@pytest.fixture()
def motor_sqlite():
    motor = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Solo las tablas que no usan sintaxis exclusiva de MySQL (b'0')
    Base.metadata.create_all(
        motor,
        tables=[
            modelos.Usuario.__table__,
            modelos.Rol.__table__,
            modelos.UsuarioRol.__table__,
            modelos.Producto.__table__,
            modelos.Inventario.__table__,
            modelos.MovimientoInventario.__table__,
            modelos.AlertaStock.__table__,
        ],
    )
    yield motor
    motor.dispose()


@pytest.fixture()
def sesion(motor_sqlite):
    SesionPrueba = sessionmaker(bind=motor_sqlite, autoflush=False, autocommit=False)
    sesion = SesionPrueba()
    try:
        yield sesion
    finally:
        sesion.close()


@pytest.fixture()
def cliente(sesion):
    def sesion_override():
        yield sesion

    aplicacion.dependency_overrides[obtener_sesion] = sesion_override
    with TestClient(aplicacion) as c:
        yield c
    aplicacion.dependency_overrides.clear()


@pytest.fixture()
def usuario_registrado(cliente):
    datos = {
        "nombre": "Prueba Uno",
        "correo": "prueba@toronto.com",
        "password": "secreta123",
        "documento": "123456",
    }
    respuesta = cliente.post("/api/v1/auth/registro", json=datos)
    assert respuesta.status_code == 201
    return {**datos, "id_usuario": respuesta.json()["id_usuario"]}


@pytest.fixture()
def token(cliente, usuario_registrado):
    respuesta = cliente.post(
        "/api/v1/auth/login",
        json={
            "correo": usuario_registrado["correo"],
            "password": usuario_registrado["password"],
        },
    )
    assert respuesta.status_code == 200
    return respuesta.json()["access_token"]
