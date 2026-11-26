"""Pruebas con Gmail simulado: no envían correos reales."""
import imaplib
import smtplib
from email.message import EmailMessage
from types import SimpleNamespace
import pytest
from pydantic import SecretStr
from app.core.config import configuracion
from app.core.dependencies import obtener_usuario_actual
from app.main import app
from app.services import correos_admin as servicio


def mensaje_contacto(nombre, direccion, asunto=servicio.ASUNTO, remitente='dotacionestoronto1@gmail.com'):
    m = EmailMessage()
    m['Subject'] = asunto
    m['From'] = remitente
    m['To'] = 'dotacionestoronto1@gmail.com'
    m['Reply-To'] = direccion
    m['Message-ID'] = f'<id-{nombre}@example.com>'
    m['Date'] = 'Tue, 17 Nov 2026 12:00:00 -0500'
    m.set_content(f'Nombre: {nombre}\nCorreo: {direccion}\n\nHola, deseo información.\n')
    return m.as_bytes()


@pytest.fixture
def gmail(monkeypatch):
    datos = {'1': mensaje_contacto('Ana', 'ana@example.com'), '2': mensaje_contacto('Luis', 'luis@example.com'), '3': mensaje_contacto('Otro', 'otro@example.com', asunto='Correo privado'), '4': mensaje_contacto('Falso', 'falso@example.com', remitente='extra@example.com')}
    estado = {'correos': [], 'logins': [], 'uidvalidity': b'44', 'fallo_en': None, 'rechazo_en': None}
    class IMAP:
        def __init__(self, host, port, ssl_context, timeout): assert (host, port, timeout) == ('imap.gmail.com', 993, 15)
        def login(self, usuario, clave): estado['logins'].append((usuario, clave))
        def select(self, mailbox, readonly):
            assert mailbox == 'INBOX' and readonly is True
            return 'OK', [b'4']
        def response(self, codigo): return 'UIDVALIDITY', [estado['uidvalidity']]
        def uid(self, comando, *args):
            if comando == 'search':
                assert args == (None, 'ALL')
                return 'OK', [' '.join(datos.keys()).encode()]
            assert comando == 'fetch' and 'BODY.PEEK[]' in args[1]
            return ('OK', [(b'body', datos[args[0]])]) if args[0] in datos else ('OK', [None])
        def logout(self): pass
    class SMTP:
        def __init__(self, host, port, timeout, context): assert (host, port, timeout) == ('smtp.gmail.com', 465, 15)
        def login(self, usuario, clave): estado['logins'].append((usuario, clave))
        def send_message(self, msg, from_addr, to_addrs):
            destino = to_addrs[0]
            if destino == estado['fallo_en']: raise TimeoutError()
            if destino == estado['rechazo_en']: raise smtplib.SMTPRecipientsRefused({destino:(550,b'bad')})
            estado['correos'].append((msg, from_addr, to_addrs))
            return {}
        def quit(self): pass
        def close(self): pass
    monkeypatch.setattr(servicio.imaplib, 'IMAP4_SSL', IMAP)
    monkeypatch.setattr(servicio.smtplib, 'SMTP_SSL', SMTP)
    monkeypatch.setattr(configuracion, 'contacto_smtp_usuario', 'dotacionestoronto1@gmail.com')
    monkeypatch.setattr(configuracion, 'contacto_smtp_password', SecretStr('abcd efgh'))
    return estado, datos


@pytest.fixture
def admin(cliente):
    app.dependency_overrides[obtener_usuario_actual] = lambda: SimpleNamespace(rol_activo=1)
    return cliente


def carga(uids=None, uidvalidity=44, asunto='Respuesta', mensaje='Muchas gracias.'):
    return {'uids': [1,2] if uids is None else uids, 'uidvalidity': uidvalidity, 'asunto': asunto, 'mensaje': mensaje}


def test_proteccion_por_rol(cliente, gmail):
    assert cliente.get('/api/v1/correos-admin').status_code == 401
    for rol in (2, 3, 4):
        app.dependency_overrides[obtener_usuario_actual] = lambda rol=rol: SimpleNamespace(rol_activo=rol)
        assert cliente.get('/api/v1/correos-admin').status_code == 403
        assert cliente.post('/api/v1/correos-admin/responder', json=carga()).status_code == 403
    assert gmail[0]['logins'] == []


def test_bandeja_incluye_todos_y_no_marca_leido(admin, gmail):
    r = admin.get('/api/v1/correos-admin')
    assert r.status_code == 200, r.text
    assert r.json()['uidvalidity'] == 44
    assert [m['uid'] for m in r.json()['items']] == [4, 3, 2, 1]
    assert r.json()['items'][2]['correo'] == 'luis@example.com'
    assert r.json()['items'][2]['tipo'] == 'formulario'
    assert r.json()['items'][1]['asunto'] == 'Correo privado'
    assert 'Hola, deseo' in r.json()['items'][2]['mensaje']
    assert gmail[0]['logins'][0][1] == 'abcdefgh'


def test_respuesta_individual_en_hilo(admin, gmail):
    r = admin.post('/api/v1/correos-admin/responder', json=carga(uids=[1]))
    assert r.status_code == 200, r.text
    assert r.json()['resultados'][0]['estado'] == 'aceptado'
    msg, sender, recipients = gmail[0]['correos'][0]
    assert recipients == ['ana@example.com'] and sender == 'dotacionestoronto1@gmail.com'
    assert str(msg['In-Reply-To']) == '<id-Ana@example.com>'
    assert str(msg['References']) == '<id-Ana@example.com>'
    assert msg.get_content().strip() == 'Muchas gracias.'


def test_masivo_individual_y_privado(admin, gmail):
    r = admin.post('/api/v1/correos-admin/responder', json=carga())
    assert r.status_code == 200
    assert [x['estado'] for x in r.json()['resultados']] == ['aceptado', 'aceptado']
    for msg, _, receptores in gmail[0]['correos']:
        assert len(receptores) == 1 and not msg.get('Cc') and not msg.get('Bcc')
        assert not msg.get('In-Reply-To')


def test_resultados_parciales_y_sin_reintentos(admin, gmail):
    estado, _ = gmail
    estado['fallo_en'] = 'luis@example.com'
    r = admin.post('/api/v1/correos-admin/responder', json=carga())
    assert [x['estado'] for x in r.json()['resultados']] == ['aceptado', 'desconocido']
    assert len(estado['correos']) == 1


def test_rechazo_explicito(admin, gmail):
    gmail[0]['rechazo_en'] = 'ana@example.com'
    r = admin.post('/api/v1/correos-admin/responder', json=carga())
    assert [x['estado'] for x in r.json()['resultados']] == ['rechazado', 'aceptado']


@pytest.mark.parametrize('datos', [carga(uids=[]), carga(uids=[1,1]), carga(uids=list(range(1,27))), carga(asunto='Hola\nBcc: x@example.com'), carga(mensaje='  '), carga(uidvalidity=0)])
def test_validacion(admin, gmail, datos):
    assert admin.post('/api/v1/correos-admin/responder', json=datos).status_code == 422
    assert not gmail[0]['correos']


def test_no_envia_a_correo_ausente_o_uid_obsoleto(admin, gmail):
    assert admin.post('/api/v1/correos-admin/responder', json=carga(uids=[999])).status_code == 409
    assert admin.post('/api/v1/correos-admin/responder', json=carga(uidvalidity=99)).status_code == 409
    assert not gmail[0]['correos']


def test_no_envia_dos_veces_al_mismo_destinatario(admin, gmail):
    gmail[1]['2'] = mensaje_contacto('Ana2', 'ana@example.com')
    assert admin.post('/api/v1/correos-admin/responder', json=carga()).status_code == 422
    assert not gmail[0]['correos']


def test_error_imap_sin_filtrar_secretos(admin, gmail, monkeypatch):
    def error(*args, **kwargs): raise imaplib.IMAP4.error('secreto')
    monkeypatch.setattr(servicio.imaplib, 'IMAP4_SSL', error)
    r = admin.get('/api/v1/correos-admin')
    assert r.status_code == 503
    assert 'secreto' not in r.text


def test_paginacion_de_anteriores(admin, gmail):
    _, datos = gmail
    for i in range(5, 65):
        datos[str(i)] = mensaje_contacto(f'Cliente{i}', f'cliente{i}@example.com')
    primero = admin.get('/api/v1/correos-admin').json()
    assert primero['siguiente_antes'] == 15
    assert len(primero['items']) == 50
    segundo = admin.get('/api/v1/correos-admin?antes=15').json()
    assert segundo['siguiente_antes'] is None
    assert [m['uid'] for m in segundo['items']] == list(range(14,0,-1))


def test_timeout_detiene_envios_posteriores(admin, gmail):
    estado, datos = gmail
    datos['5'] = mensaje_contacto('Rosa', 'rosa@example.com')
    estado['fallo_en'] = 'luis@example.com'
    r = admin.post('/api/v1/correos-admin/responder', json=carga(uids=[1,2,5]))
    assert [x['estado'] for x in r.json()['resultados']] == ['aceptado', 'desconocido', 'no_enviado']
    assert len(estado['correos']) == 1


def test_cierre_smtp_fallido_no_cambia_estado_aceptado(admin, gmail, monkeypatch):
    real = servicio.smtplib.SMTP_SSL
    def factory(*args, **kwargs):
        smtp = real(*args, **kwargs)
        def fallar(): raise OSError('desconectado')
        smtp.quit = fallar
        return smtp
    monkeypatch.setattr(servicio.smtplib, 'SMTP_SSL', factory)
    r = admin.post('/api/v1/correos-admin/responder', json=carga(uids=[1]))
    assert r.json()['resultados'][0]['estado'] == 'aceptado'


def test_sin_clave_configurada(admin, gmail, monkeypatch):
    monkeypatch.setattr(configuracion, 'contacto_smtp_password', SecretStr(''))
    r = admin.get('/api/v1/correos-admin')
    assert r.status_code == 503 and not gmail[0]['logins']


def test_respuesta_cliente_entrante_con_from_y_responder(admin, gmail):
    correo = EmailMessage()
    correo['From'] = 'Ana Cliente <ana@example.com>'
    correo['To'] = 'dotacionestoronto1@gmail.com'
    correo['Subject'] = 'Re: Cotización'
    correo['Message-ID'] = '<respuesta-real@example.com>'
    correo.set_content('Sí, me interesa la cotización.')
    gmail[1]['5'] = correo.as_bytes()
    r = admin.get('/api/v1/correos-admin')
    item = r.json()['items'][0]
    assert item['correo'] == 'ana@example.com'
    assert item['remitente'] == 'ana@example.com'
    assert item['nombre'] == 'Ana Cliente'
    assert item['asunto'] == 'Re: Cotización'
    assert 'me interesa' in item['mensaje']
    assert item['tipo'] == 'correo'
    r = admin.post('/api/v1/correos-admin/responder', json=carga(uids=[5]))
    assert r.status_code == 200
    msg, _, to = gmail[0]['correos'][0]
    assert to == ['ana@example.com']
    assert str(msg['In-Reply-To']) == '<respuesta-real@example.com>'


def test_respuesta_usa_reply_to_mostrando_remitente(admin, gmail):
    correo = EmailMessage()
    correo['From'] = 'info@example.com'
    correo['Reply-To'] = 'persona@example.com'
    correo['Subject'] = 'Respuesta'
    correo.set_content('Buenas tardes')
    gmail[1]['6'] = correo.as_bytes()
    item = admin.get('/api/v1/correos-admin').json()['items'][0]
    assert item['remitente'] == 'info@example.com' and item['correo'] == 'persona@example.com'
    assert admin.post('/api/v1/correos-admin/responder', json=carga(uids=[6])).status_code == 200
    assert gmail[0]['correos'][0][2] == ['persona@example.com']


def test_html_se_muestra_como_texto_sin_elementos_activos(admin, gmail):
    correo = EmailMessage()
    correo['From'] = 'ana@example.com'
    correo['Subject'] = 'Hola'
    correo.set_content('<html><head><style>oculto</style></head><body><p>Hola <b>cliente</b></p><script>alert(1)</script><img src="https://ejemplo.com/seguimiento"></body></html>', subtype='html')
    gmail[1]['7'] = correo.as_bytes()
    item = admin.get('/api/v1/correos-admin').json()['items'][0]
    assert 'Hola cliente' in item['mensaje']
    assert 'alert(1)' not in item['mensaje'] and 'seguimiento' not in item['mensaje']


def test_sin_remitente_valido_no_permite_enviar(admin, gmail):
    correo = EmailMessage()
    correo['From'] = 'ana@example.com'
    correo['Reply-To'] = 'primero@example.com, segundo@example.com'
    correo['Subject'] = 'Hola'
    correo.set_content('Respuesta')
    gmail[1]['8'] = correo.as_bytes()
    item = admin.get('/api/v1/correos-admin').json()['items'][0]
    assert item['correo'] is None
    assert admin.post('/api/v1/correos-admin/responder', json=carga(uids=[8])).status_code == 422
    assert not gmail[0]['correos']
