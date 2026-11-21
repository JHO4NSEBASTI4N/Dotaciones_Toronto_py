"""Pruebas del formulario de contacto: no se envían correos reales."""
import smtplib

import pytest
from pydantic import SecretStr

from app.api.v1.endpoints import contacto as endpoint
from app.core.config import configuracion
from app.services import contacto as servicio


@pytest.fixture(autouse=True)
def limpiar_limite():
    with endpoint._cerrojo:
        endpoint._intentos.clear()
    yield
    with endpoint._cerrojo:
        endpoint._intentos.clear()


@pytest.fixture
def smtp_falso(monkeypatch):
    llamadas = {}

    class SMTPFalso:
        def __init__(self, host, puerto, *, timeout, context):
            llamadas.update(host=host, puerto=puerto, timeout=timeout, context=context)
        def __enter__(self):
            return self
        def __exit__(self, *args):
            return False
        def login(self, usuario, clave):
            llamadas["login"] = (usuario, clave)
        def send_message(self, mensaje, from_addr, to_addrs):
            llamadas.update(mensaje=mensaje, from_addr=from_addr, to_addrs=to_addrs)

    monkeypatch.setattr(servicio.smtplib, "SMTP_SSL", SMTPFalso)
    monkeypatch.setattr(configuracion, "contacto_smtp_usuario", "dotacionestoronto1@gmail.com")
    monkeypatch.setattr(configuracion, "contacto_smtp_password", SecretStr("abcd efgh ijkl mnop"))
    return llamadas


DATOS = {"nombre": "  María López  ", "correo": "cliente@example.com", "mensaje": "  Necesito una cotización.  "}


def test_enviar_sin_iniciar_sesion(cliente, smtp_falso):
    respuesta = cliente.post("/api/v1/contacto", json=DATOS)
    assert respuesta.status_code == 200
    assert smtp_falso["host"] == "smtp.gmail.com"
    assert smtp_falso["puerto"] == 465
    assert smtp_falso["timeout"] == 15
    assert smtp_falso["login"] == ("dotacionestoronto1@gmail.com", "abcdefghijklmnop")
    assert smtp_falso["from_addr"] == "dotacionestoronto1@gmail.com"
    assert smtp_falso["to_addrs"] == ["dotacionestoronto1@gmail.com"]
    mensaje = smtp_falso["mensaje"]
    assert mensaje["To"] == "dotacionestoronto1@gmail.com"
    assert mensaje["Reply-To"] == "cliente@example.com"
    assert "María López" in mensaje.get_content()
    assert "Necesito una cotización." in mensaje.get_content()


@pytest.mark.parametrize("cambios", [
    {"correo": "incorrecto"}, {"nombre": "   "}, {"mensaje": "  "},
    {"nombre": "a" * 101}, {"mensaje": "x" * 3001},
    {"nombre": "Nombre\nBcc: intruso@example.com"},
    {"correo": "cliente@example.com\nBcc: intruso@example.com"},
])
def test_rechaza_datos_invalidos(cliente, smtp_falso, cambios):
    respuesta = cliente.post("/api/v1/contacto", json={**DATOS, **cambios})
    assert respuesta.status_code == 422
    assert "mensaje" not in smtp_falso


def test_sin_clave_no_finge_envio(cliente, monkeypatch):
    monkeypatch.setattr(configuracion, "contacto_smtp_password", SecretStr(""))
    respuesta = cliente.post("/api/v1/contacto", json=DATOS)
    assert respuesta.status_code == 503
    assert "no está configurado" in respuesta.json()["detalle"]


@pytest.mark.parametrize("error", [smtplib.SMTPAuthenticationError(535, b"bad credentials"), TimeoutError("timeout")])
def test_error_smtp_es_informado_sin_datos_sensibles(cliente, smtp_falso, monkeypatch, error):
    def fallar(*args, **kwargs):
        raise error
    monkeypatch.setattr(servicio.smtplib, "SMTP_SSL", fallar)
    respuesta = cliente.post("/api/v1/contacto", json=DATOS)
    assert respuesta.status_code == 503
    assert "bad credentials" not in respuesta.text
    assert "abcdefghijklmnop" not in respuesta.text


def test_limite_anti_abuso(cliente, smtp_falso):
    for _ in range(5):
        assert cliente.post("/api/v1/contacto", json=DATOS).status_code == 200
    respuesta = cliente.post("/api/v1/contacto", json=DATOS)
    assert respuesta.status_code == 429
    assert int(respuesta.headers["retry-after"]) > 0
