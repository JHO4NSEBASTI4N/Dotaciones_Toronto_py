"""Reglas de registro también obligatorias al consumir directamente la API."""
import pytest
from sqlalchemy import select, func
from app.models.usuario import Usuario

URL = "/api/v1/auth/registro"
BASE = {"nombre": "María Pérez", "correo": "maria@example.com", "password": "Clave123!"}

@pytest.mark.parametrize("campo,valor", [
    ("nombre", ""), ("nombre", " A "), ("nombre", "Juan 3"), ("nombre", "A" * 61),
    ("correo", ""), ("correo", "no-correo"), ("correo", "ana@dominio..com"),
    ("documento", "12345"), ("documento", "1234567890123"), ("documento", "12345a"), ("documento", "１２３４５６"),
    ("telefono", "123456"), ("telefono", "12345678901"), ("telefono", "3001234a"),
    ("direccion", "x" * 256),
    ("password", ""), ("password", "Aa1!"), ("password", "12345678!"),
    ("password", "abcdefgh!"), ("password", "abcdefgh1"),
    ("password", "á" * 35 + "1!!"),
])
def test_peticion_directa_rechaza_campos_invalidos(cliente, sesion, campo, valor):
    respuesta = cliente.post(URL, json={**BASE, campo: valor})
    assert respuesta.status_code == 422, respuesta.text
    assert any(error['loc'][-1] == campo for error in respuesta.json()['detail'])
    assert sesion.scalar(select(func.count()).select_from(Usuario)) == 0

@pytest.mark.parametrize("documento,telefono,direccion", [
    (None, None, None), ("", "", ""), ("123456", "1234567", "Calle 123"),
    ("123456789012", "1234567890", "x" * 255),
])
def test_registro_valido_con_opcionales(cliente, documento, telefono, direccion):
    respuesta = cliente.post(URL, json={**BASE, 'documento': documento, 'telefono': telefono, 'direccion': direccion})
    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.json()['documento'] == (documento or None)
    assert respuesta.json()['telefono'] == (telefono or None)
    assert respuesta.json()['direccion'] == (direccion or None)


def test_recorta_nombre_direccion_y_no_guarda_password_plana(cliente, sesion):
    respuesta = cliente.post(URL, json={**BASE, 'nombre': '  María Pérez  ', 'direccion': ' Calle 1 '})
    assert respuesta.status_code == 201
    assert respuesta.json()['nombre'] == 'María Pérez'
    assert respuesta.json()['direccion'] == 'Calle 1'
    assert 'password' not in respuesta.json()
    assert sesion.scalar(select(Usuario)).password != BASE['password']


def test_longitud_en_bytes_y_caracteres_unicode(cliente):
    permitido = 'á' * 34 + 'a1!x'  # 72 bytes
    assert len(permitido.encode()) == 72
    assert cliente.post(URL, json={**BASE, 'password': permitido}).status_code == 201
    assert cliente.post(URL, json={**BASE, 'correo': 'otro@example.com', 'password': permitido + 'x'}).status_code == 422


def test_rol_y_estado_enviados_no_controlan_registro(cliente):
    respuesta = cliente.post(URL, json={**BASE, 'id_rol_fk': 1, 'estado': 'Inhabilitado'})
    assert respuesta.status_code == 201
    assert respuesta.json()['id_rol_fk'] != 1
    assert respuesta.json()['estado'] == 'Habilitado'
