"""Bandeja de entrada Gmail y respuestas. IMAP se usa en modo solo lectura."""
import imaplib
import logging
import re
import smtplib
import ssl
from contextlib import contextmanager
from email import policy
from email.message import EmailMessage
from email.parser import BytesParser
from email.utils import getaddresses
from html.parser import HTMLParser

from fastapi import HTTPException
from pydantic import EmailStr, TypeAdapter, ValidationError

from app.core.config import configuracion
from app.core.exceptions import ServicioNoDisponible

logger = logging.getLogger(__name__)
ASUNTO = 'Nuevo mensaje desde la página de Dotaciones Toronto'
MAX_BYTES = 100_000
email_validador = TypeAdapter(EmailStr)


def _credenciales():
    usuario = configuracion.contacto_smtp_usuario.strip()
    clave = configuracion.contacto_smtp_password.get_secret_value().replace(' ', '').strip()
    if not usuario or not clave:
        raise ServicioNoDisponible('Configura el correo de contacto y su contraseña de aplicación en el backend.')
    return usuario, clave


@contextmanager
def _bandeja():
    usuario, clave = _credenciales()
    conexion = None
    try:
        conexion = imaplib.IMAP4_SSL('imap.gmail.com', 993, ssl_context=ssl.create_default_context(), timeout=15)
        conexion.login(usuario, clave)
        estado, _ = conexion.select('INBOX', readonly=True)
        if estado != 'OK':
            raise imaplib.IMAP4.error('No se pudo abrir INBOX')
        estado, datos = conexion.response('UIDVALIDITY')
        if estado != 'UIDVALIDITY' or not datos or not datos[0] or not datos[0].isdigit():
            raise imaplib.IMAP4.error('UIDVALIDITY ausente')
        yield conexion, usuario, clave, int(datos[0])
    except (imaplib.IMAP4.error, OSError, TimeoutError, ValueError) as error:
        logger.warning('No se pudo consultar Gmail (%s)', type(error).__name__)
        raise ServicioNoDisponible('No se pudo consultar Gmail. Revisa la cuenta, la contraseña de aplicación, IMAP y la conexión.') from error
    finally:
        if conexion is not None:
            try:
                conexion.logout()
            except (imaplib.IMAP4.error, OSError):
                pass


def _direccion_unica(cabecera):
    direcciones = getaddresses([str(cabecera or '')])
    if len(direcciones) != 1:
        return None
    try:
        return str(email_validador.validate_python(direcciones[0][1]))
    except (ValidationError, ValueError):
        return None


class _TextoHTML(HTMLParser):
    """Extrae solo texto, sin ejecutar HTML, scripts, imágenes ni enlaces."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.partes = []
        self.oculto = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'head'):
            self.oculto += 1
        elif not self.oculto and tag in ('br', 'p', 'div', 'li', 'tr'):
            self.partes.append('\n')

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'head') and self.oculto:
            self.oculto -= 1
        elif not self.oculto and tag in ('p', 'div', 'li', 'tr'):
            self.partes.append('\n')

    def handle_data(self, data):
        if not self.oculto:
            self.partes.append(data)


def _texto(correo):
    parte = correo.get_body(preferencelist=('plain', 'html')) if correo.is_multipart() else correo
    if parte is None or parte.get_content_type() not in ('text/plain', 'text/html'):
        return '[Este correo no tiene texto visible. Consulta Gmail para ver adjuntos u otro contenido.]'
    try:
        contenido = parte.get_content()
    except (LookupError, ValueError, UnicodeError):
        return '[No se pudo mostrar el texto. Consulta este correo en Gmail.]'
    if not isinstance(contenido, str):
        return '[No se pudo mostrar el texto. Consulta este correo en Gmail.]'
    if parte.get_content_type() == 'text/html':
        parser = _TextoHTML()
        parser.feed(contenido)
        contenido = ''.join(parser.partes)
    return contenido.strip()[:5000] or '[Correo sin texto visible. Consulta Gmail para ver adjuntos.]'


def _leer(conexion, uid, usuario):
    estado, respuesta = conexion.uid('fetch', str(uid), f'(BODY.PEEK[]<0.{MAX_BYTES}>)')
    if estado != 'OK':
        raise imaplib.IMAP4.error('Error al consultar mensaje')
    partes = [dato[1] for dato in respuesta if isinstance(dato, tuple) and isinstance(dato[1], bytes)]
    if not partes:
        return None
    correo = BytesParser(policy=policy.default).parsebytes(partes[0])
    remitente = _direccion_unica(correo.get('From'))
    reply_to = correo.get('Reply-To')
    # Cuando Reply-To existe pero es inválido/múltiple, no adivinar el destino.
    destino = _direccion_unica(reply_to) if reply_to is not None else remitente
    texto = _texto(correo)
    asunto = str(correo.get('Subject', '')).replace('\r', ' ').replace('\n', ' ').strip()[:160] or '(Sin asunto)'
    nombre = ''
    from_pairs = getaddresses([str(correo.get('From', ''))])
    if len(from_pairs) == 1:
        nombre = from_pairs[0][0].strip()[:100]
    # El formulario se envía a la misma cuenta con Reply-To del visitante.
    lineas = texto.splitlines()
    es_formulario = (asunto == ASUNTO and remitente and remitente.casefold() == usuario.casefold()
                     and destino and len(lineas) >= 3 and lineas[0].startswith('Nombre: ')
                     and lineas[1].startswith('Correo: ')
                     and lineas[1][8:].strip().casefold() == destino.casefold())
    if es_formulario:
        nombre = lineas[0][8:][:100]
        texto = '\n'.join(lineas[2:]).strip()
    message_id = str(correo.get('Message-ID', '')).strip()
    if not re.fullmatch(r'<[^<>\s@]+@[^<>\s@]+>', message_id):
        message_id = ''
    return {'uid': int(uid), 'nombre': nombre or remitente or 'Remitente desconocido',
            'remitente': remitente, 'correo': destino, 'asunto': asunto, 'mensaje': texto,
            'fecha': str(correo.get('Date', ''))[:100], 'message_id': message_id,
            'tipo': 'formulario' if es_formulario else 'correo'}


def listar(antes=None):
    with _bandeja() as (conexion, usuario, _, version):
        estado, datos = conexion.uid('search', None, 'ALL')
        if estado != 'OK':
            raise imaplib.IMAP4.error('Error en búsqueda')
        uids = [int(n) for n in (datos[0] or b'').split() if n.isdigit()]
        uids = sorted((n for n in uids if antes is None or n < antes), reverse=True)
        # Se examinan como máximo 50 por página para limitar trabajo remoto.
        pagina = uids[:50]
        items = []
        for uid in pagina:
            correo = _leer(conexion, uid, usuario)
            if correo:
                correo.pop('message_id')
                items.append(correo)
        return {'uidvalidity': version, 'items': items, 'siguiente_antes': pagina[-1] if len(uids) > 50 else None}


def responder(uids, version, asunto, texto):
    with _bandeja() as (conexion, usuario, clave, version_actual):
        if version != version_actual:
            raise HTTPException(409, 'La bandeja cambió. Actualiza la lista antes de enviar.')
        mensajes = [_leer(conexion, uid, usuario) for uid in uids]
        if any(m is None for m in mensajes):
            raise HTTPException(409, 'Un mensaje ya no está disponible. Actualiza la bandeja.')
        if any(not m['correo'] for m in mensajes):
            raise HTTPException(422, 'Un mensaje no tiene una dirección de respuesta válida y única.')
    # Evitar múltiples envíos al mismo destinatario en una misma operación.
    correos = [m['correo'].casefold() for m in mensajes]
    if len(set(correos)) != len(correos):
        raise HTTPException(422, 'Hay mensajes del mismo correo seleccionados. Elige solo uno por destinatario.')
    resultados = []
    for indice, original in enumerate(mensajes):
        mensaje = EmailMessage()
        mensaje['From'] = usuario
        mensaje['To'] = original['correo']
        mensaje['Subject'] = asunto
        if len(mensajes) == 1 and original['message_id']:
            mensaje['In-Reply-To'] = original['message_id']
            mensaje['References'] = original['message_id']
        mensaje.set_content(texto)
        servidor = None
        try:
            servidor = smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=15, context=ssl.create_default_context())
            servidor.login(usuario, clave)
        except (smtplib.SMTPException, OSError, TimeoutError, ValueError) as error:
            logger.warning('No se pudo iniciar SMTP (%s)', type(error).__name__)
            if servidor:
                try:
                    servidor.close()
                except (OSError, smtplib.SMTPException):
                    pass
            resultados.extend({'uid': m['uid'], 'correo': m['correo'], 'estado': 'no_enviado'} for m in mensajes[indice:])
            break
        try:
            rechazados = servidor.send_message(mensaje, from_addr=usuario, to_addrs=[original['correo']])
            estado = 'rechazado' if rechazados else 'aceptado'
        except smtplib.SMTPRecipientsRefused:
            estado = 'rechazado'
        except (smtplib.SMTPException, OSError, TimeoutError):
            # No es seguro saber si el servidor recibió el mensaje.
            estado = 'desconocido'
        finally:
            try:
                servidor.quit()
            except (smtplib.SMTPException, OSError, TimeoutError):
                try:
                    servidor.close()
                except (smtplib.SMTPException, OSError):
                    pass
        resultados.append({'uid': original['uid'], 'correo': original['correo'], 'estado': estado})
        if estado == 'desconocido':
            resultados.extend({'uid': m['uid'], 'correo': m['correo'], 'estado': 'no_enviado'} for m in mensajes[indice + 1:])
            break
    return {'resultados': resultados}
