"""Recuperación sin correo real; SMTP y tiempo controlados."""
from datetime import timedelta
import re
import smtplib

import pytest
from pydantic import SecretStr
from sqlalchemy import select

from app.api.v1.endpoints import recuperacion as endpoint
from app.core.config import configuracion
from app.core.security import hashear_password, verificar_password
from app.models.recuperacion_password import RecuperacionPassword
from app.models.usuario import Usuario
from app.services import recuperacion as servicio

BASE = '/api/v1/auth/recuperacion'

@pytest.fixture(autouse=True)
def limpiar_limitador():
    with endpoint._lock: endpoint._registros.clear()
    yield
    with endpoint._lock: endpoint._registros.clear()

@pytest.fixture
def cuenta(sesion):
    u = Usuario(nombre='Persona Prueba', correo='personal@ejemplo.com', password=hashear_password('original123'), estado='Habilitado', id_rol_fk=2)
    sesion.add(u); sesion.commit(); return u

@pytest.fixture
def mensajes(monkeypatch):
    enviados = []
    monkeypatch.setattr(servicio, 'enviar_codigo', lambda correo, codigo: enviados.append((correo,codigo)))
    return enviados

def solicitar(cliente, correo='personal@ejemplo.com'):
    return cliente.post(BASE + '/solicitar', json={'correo': correo})

def verificar(cliente, codigo, correo='personal@ejemplo.com'):
    return cliente.post(BASE + '/verificar', json={'correo': correo, 'codigo': codigo})

def cambiar(cliente, ticket, password='NuevaClave123!', correo='personal@ejemplo.com'):
    return cliente.post(BASE + '/cambiar', json={'correo': correo, 'ticket': ticket, 'password_nueva': password})

def test_flujo_completo_codigo_y_ticket_un_solo_uso(cliente, cuenta, mensajes, sesion):
    assert solicitar(cliente).status_code == 200
    correo, codigo = mensajes[0]
    assert correo == cuenta.correo and re.fullmatch(r'\d{6}', codigo)
    registro = sesion.get(RecuperacionPassword, cuenta.id_usuario)
    assert codigo not in registro.codigo_hash
    respuesta = verificar(cliente, codigo)
    assert respuesta.status_code == 200
    ticket = respuesta.json()['ticket']
    assert verificar(cliente, codigo).status_code == 400
    assert cambiar(cliente, ticket).status_code == 200
    assert cambiar(cliente, ticket).status_code == 400
    sesion.refresh(cuenta)
    assert verificar_password('NuevaClave123!', cuenta.password)
    assert not verificar_password('original123', cuenta.password)
    assert cliente.post('/api/v1/auth/login', json={'correo': cuenta.correo, 'password':'NuevaClave123!'}).status_code == 200

def test_mensaje_generico_correo_inexistente_y_no_habilitado(cliente, cuenta, mensajes, sesion):
    real = solicitar(cliente).json()
    inexistente = solicitar(cliente, 'nadie@ejemplo.com').json()
    cuenta.estado = 'Inhabilitado'; sesion.commit()
    inhabilitado = solicitar(cliente).json()
    assert real == inexistente == inhabilitado
    assert len(mensajes) == 1

def test_codigo_incorrecto_bloquea_tras_cinco(cliente, cuenta, mensajes, sesion):
    solicitar(cliente)
    codigo = mensajes[0][1]
    incorrecto = '999999' if codigo != '999999' else '000000'
    for _ in range(5): assert verificar(cliente, incorrecto).status_code == 400
    assert verificar(cliente, codigo).status_code == 400
    solicitar(cliente)
    assert len(mensajes) == 1
    r = sesion.get(RecuperacionPassword, cuenta.id_usuario)
    assert r.intentos == 5 and r.bloqueado_hasta is not None

def test_codigo_y_ticket_expiran(cliente, cuenta, mensajes, sesion):
    solicitar(cliente)
    r = sesion.get(RecuperacionPassword, cuenta.id_usuario)
    r.expira_en = servicio.ahora_utc() - timedelta(seconds=1); sesion.commit()
    assert verificar(cliente, mensajes[0][1]).status_code == 400
    r.creado_en -= timedelta(minutes=2); sesion.commit()
    solicitar(cliente); ticket = verificar(cliente, mensajes[-1][1]).json()['ticket']
    r.expira_en = servicio.ahora_utc() - timedelta(seconds=1); sesion.commit()
    assert cambiar(cliente, ticket).status_code == 400

def test_un_nuevo_codigo_invalida_el_anterior(cliente, cuenta, mensajes, sesion, monkeypatch):
    codigos = iter([123456, 654321]); monkeypatch.setattr(servicio.secrets, 'randbelow', lambda n: next(codigos))
    solicitar(cliente); r = sesion.get(RecuperacionPassword, cuenta.id_usuario)
    solicitar(cliente); assert len(mensajes) == 1
    r.creado_en -= timedelta(minutes=2); sesion.commit()
    solicitar(cliente); assert len(mensajes) == 2
    assert verificar(cliente, '123456').status_code == 400
    assert verificar(cliente, '654321').status_code == 200

def test_password_modificada_invalida_recuperacion(cliente, cuenta, mensajes, sesion):
    solicitar(cliente); ticket = verificar(cliente, mensajes[0][1]).json()['ticket']
    cuenta.password = hashear_password('cambiada123'); sesion.commit()
    assert cambiar(cliente, ticket).status_code == 400

def test_fallo_de_correo_no_revela_cuenta_y_anula_codigo(cliente, cuenta, sesion, monkeypatch):
    def falla(*args): raise smtplib.SMTPServerDisconnected('no incluir detalles')
    monkeypatch.setattr(servicio, 'enviar_codigo', falla)
    real = solicitar(cliente); inexistente = solicitar(cliente, 'nadie@ejemplo.com')
    assert real.status_code == 200 and real.json() == inexistente.json()
    assert sesion.get(RecuperacionPassword, cuenta.id_usuario).codigo_hash is None
    assert 'no incluir detalles' not in real.text

def test_contrasena_invalida_no_consume_ticket(cliente, cuenta, mensajes):
    solicitar(cliente); ticket = verificar(cliente, mensajes[0][1]).json()['ticket']
    assert cambiar(cliente, ticket, 'corta').status_code == 422
    assert cambiar(cliente, ticket, 'á' * 40).status_code == 422
    assert cambiar(cliente, ticket, 'Correcta123!').status_code == 200

def test_limite_por_ip(cliente, mensajes):
    for _ in range(5): assert solicitar(cliente, 'nadie@ejemplo.com').status_code == 200
    assert solicitar(cliente, 'nadie@ejemplo.com').status_code == 429

def test_smtp_se_envia_al_correo_personal(monkeypatch):
    capturado = {}
    class SMTP:
        def __init__(self, *args, **kwargs): capturado['servidor'] = args
        def __enter__(self): return self
        def __exit__(self, *args): return False
        def login(self, usuario, clave): capturado['login'] = (usuario, clave)
        def send_message(self, mensaje, from_addr, to_addrs): capturado.update(mensaje=mensaje, from_addr=from_addr, to_addrs=to_addrs)
    monkeypatch.setattr(servicio.smtplib, 'SMTP_SSL', SMTP)
    monkeypatch.setattr(configuracion, 'contacto_smtp_usuario', 'dotacionestoronto1@gmail.com')
    monkeypatch.setattr(configuracion, 'contacto_smtp_password', SecretStr('abcd efgh ijkl mnop'))
    servicio.enviar_codigo('personal@ejemplo.com', '012345')
    assert capturado['servidor'] == ('smtp.gmail.com', 465)
    assert capturado['to_addrs'] == ['personal@ejemplo.com']
    assert '012345' in capturado['mensaje'].get_content()
    assert capturado['login'][1] == 'abcdefghijklmnop'
