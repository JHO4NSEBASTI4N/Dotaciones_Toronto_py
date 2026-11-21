"""Recuperacion con codigo de un uso y ticket de un uso, ambos guardados como HMAC."""
import hashlib
import hmac
import logging
import secrets
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session
from app.core.config import configuracion
from app.core.exceptions import ReglaNegocio
from app.core.security import hashear_password
from app.models.recuperacion_password import RecuperacionPassword
from app.models.usuario import Usuario

logger = logging.getLogger(__name__)
MENSAJE = 'Si el correo corresponde a una cuenta habilitada, recibirás un código. Revisa también spam.'
ERROR = 'El código o la solicitud no son válidos, expiraron o alcanzaron el límite de intentos.'
VIDA = timedelta(minutes=10)
ESPERA = timedelta(seconds=60)
BLOQUEO = timedelta(minutes=15)
MAX_INTENTOS = 5

def ahora_utc():
    # Se guardan fechas UTC sin zona para portabilidad MySQL/SQLite.
    return datetime.now(timezone.utc).replace(tzinfo=None)

def _hash(proposito: str, valor: str) -> str:
    return hmac.new(configuracion.secret_key.encode('utf8'), (proposito + ':' + valor).encode('utf8'), hashlib.sha256).hexdigest()

def _usuario(sesion: Session, correo: str):
    return sesion.scalar(select(Usuario).where(func.lower(Usuario.correo) == correo.lower()).with_for_update())

def _activo(usuario):
    return usuario is not None and (usuario.estado or '').lower() == 'habilitado'

def _estado_valido(registro, usuario, ahora):
    return (registro is not None and _activo(usuario) and registro.expira_en > ahora
            and (registro.bloqueado_hasta is None or registro.bloqueado_hasta <= ahora)
            and hmac.compare_digest(registro.password_fingerprint, _hash('password', usuario.password)))

def enviar_codigo(correo: str, codigo: str):
    usuario = configuracion.contacto_smtp_usuario.strip()
    clave = configuracion.contacto_smtp_password.get_secret_value().replace(' ', '').strip()
    if not usuario or not clave:
        raise RuntimeError('SMTP sin configurar')
    mensaje = EmailMessage()
    mensaje['Subject'] = 'Código para recuperar tu contraseña - Dotaciones Toronto'
    mensaje['From'] = usuario
    mensaje['To'] = correo
    mensaje.set_content(f'Tu código de recuperación es: {codigo}\n\nCaduca en 10 minutos y solo se puede usar una vez. Si no solicitaste el cambio, ignora este correo. No compartas este código.\n')
    with smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=15, context=ssl.create_default_context()) as servidor:
        servidor.login(usuario, clave)
        servidor.send_message(mensaje, from_addr=usuario, to_addrs=[correo])

def solicitar(sesion: Session, correo: str):
    usuario = _usuario(sesion, correo)
    ahora = ahora_utc()
    if not _activo(usuario):
        return
    registro = sesion.get(RecuperacionPassword, usuario.id_usuario)
    if registro and ((registro.bloqueado_hasta and registro.bloqueado_hasta > ahora) or registro.creado_en + ESPERA > ahora):
        return
    codigo = f'{secrets.randbelow(1000000):06d}'
    digest = _hash('codigo', f'{usuario.id_usuario}:{codigo}')
    if registro is None:
        registro = RecuperacionPassword(id_usuario_fk=usuario.id_usuario)
        sesion.add(registro)
    registro.codigo_hash = digest
    registro.ticket_hash = None
    registro.password_fingerprint = _hash('password', usuario.password)
    registro.creado_en = ahora
    registro.expira_en = ahora + VIDA
    registro.intentos = 0
    registro.bloqueado_hasta = None
    destino = usuario.correo
    sesion.commit()
    try:
        enviar_codigo(destino, codigo)
    except (smtplib.SMTPException, OSError, ValueError, RuntimeError) as exc:
        logger.warning('No se pudo enviar el código de recuperación (%s)', type(exc).__name__)
        # No revelar al navegador si el correo existe. Invalida solo este código,
        # sin destruir una solicitud posterior que pudo haberse creado en paralelo.
        sesion.execute(update(RecuperacionPassword).where(
            RecuperacionPassword.id_usuario_fk == usuario.id_usuario,
            RecuperacionPassword.codigo_hash == digest,
        ).values(codigo_hash=None))
        sesion.commit()

def verificar(sesion: Session, correo: str, codigo: str) -> str:
    usuario = _usuario(sesion, correo)
    registro = sesion.get(RecuperacionPassword, usuario.id_usuario) if usuario else None
    ahora = ahora_utc()
    if not _estado_valido(registro, usuario, ahora) or not registro.codigo_hash:
        raise ReglaNegocio(ERROR)
    esperado = _hash('codigo', f'{usuario.id_usuario}:{codigo}')
    if not hmac.compare_digest(registro.codigo_hash, esperado):
        registro.intentos += 1
        if registro.intentos >= MAX_INTENTOS:
            registro.codigo_hash = None
            registro.ticket_hash = None
            registro.bloqueado_hasta = ahora + BLOQUEO
        sesion.commit()
        raise ReglaNegocio(ERROR)
    ticket = secrets.token_urlsafe(32)
    registro.ticket_hash = _hash('ticket', f'{usuario.id_usuario}:{ticket}')
    registro.codigo_hash = None
    sesion.commit()
    return ticket

def cambiar(sesion: Session, correo: str, ticket: str, password: str):
    usuario = _usuario(sesion, correo)
    registro = sesion.get(RecuperacionPassword, usuario.id_usuario) if usuario else None
    ahora = ahora_utc()
    if not _estado_valido(registro, usuario, ahora) or not registro.ticket_hash:
        raise ReglaNegocio(ERROR)
    if not hmac.compare_digest(registro.ticket_hash, _hash('ticket', f'{usuario.id_usuario}:{ticket}')):
        raise ReglaNegocio(ERROR)
    usuario.password = hashear_password(password)
    registro.ticket_hash = None
    registro.codigo_hash = None
    sesion.commit()
