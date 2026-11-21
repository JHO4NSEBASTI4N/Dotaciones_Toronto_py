"""Entrega de mensajes del formulario mediante SMTP seguro de Gmail."""
import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import configuracion
from app.core.exceptions import ServicioNoDisponible
from app.schemas.contacto import MensajeContacto

logger = logging.getLogger(__name__)
DESTINATARIO = "dotacionestoronto1@gmail.com"


def enviar_mensaje(datos: MensajeContacto) -> None:
    usuario = configuracion.contacto_smtp_usuario.strip()
    clave = configuracion.contacto_smtp_password.get_secret_value().replace(" ", "").strip()
    if not usuario or not clave:
        raise ServicioNoDisponible("El correo de contacto todavía no está configurado. Inténtalo más tarde.")

    mensaje = EmailMessage()
    mensaje["Subject"] = "Nuevo mensaje desde la página de Dotaciones Toronto"
    mensaje["From"] = usuario
    mensaje["To"] = DESTINATARIO
    # El remitente autenticado debe ser la cuenta SMTP; al responder se usa
    # la dirección del visitante. No se coloca información del usuario en Subject.
    mensaje["Reply-To"] = str(datos.correo)
    mensaje.set_content(
        f"Nombre: {datos.nombre}\nCorreo: {datos.correo}\n\nMensaje:\n{datos.mensaje}\n"
    )

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15, context=ssl.create_default_context()) as servidor:
            servidor.login(usuario, clave)
            servidor.send_message(mensaje, from_addr=usuario, to_addrs=[DESTINATARIO])
    except (smtplib.SMTPException, OSError, ValueError) as error:
        # Evitar registrar credenciales, direcciones de visitantes o el mensaje.
        logger.warning("No se pudo enviar el correo de contacto (%s)", type(error).__name__)
        raise ServicioNoDisponible("No se pudo enviar el mensaje. Inténtalo de nuevo más tarde.") from error
