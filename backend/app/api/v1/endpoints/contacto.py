"""Formulario publico de contacto; sin acceso a la base de datos."""
from collections import OrderedDict, deque
from threading import Lock
from time import monotonic

from fastapi import APIRouter, HTTPException, Request, status

from app.schemas.contacto import MensajeContacto
from app.services.contacto import enviar_mensaje

router = APIRouter()

# Limite basico contra abuso: 5 intentos por IP cada 15 minutos y por proceso.
# En despliegues con varios workers/proxy se debe reforzar en el proxy o WAF.
_MAX_INTENTOS = 5
_VENTANA = 15 * 60
_MAX_IPS = 10000
_intentos: OrderedDict[str, deque[float]] = OrderedDict()
_cerrojo = Lock()


def _limitar(ip: str) -> None:
    ahora = monotonic()
    with _cerrojo:
        if ip not in _intentos and len(_intentos) >= _MAX_IPS:
            _intentos.popitem(last=False)
        intentos = _intentos.setdefault(ip, deque())
        _intentos.move_to_end(ip)
        while intentos and ahora - intentos[0] >= _VENTANA:
            intentos.popleft()
        if len(intentos) >= _MAX_INTENTOS:
            restante = max(1, int(_VENTANA - (ahora - intentos[0])) + 1)
            raise HTTPException(status_code=429, detail="Demasiados intentos. Espera unos minutos antes de volver a enviar.", headers={"Retry-After": str(restante)})
        intentos.append(ahora)


@router.post("", status_code=status.HTTP_200_OK)
def enviar_contacto(datos: MensajeContacto, request: Request):
    # No se confia en X-Forwarded-For enviado por el usuario.
    _limitar(request.client.host if request.client else "desconocido")
    enviar_mensaje(datos)
    return {"mensaje": "Mensaje enviado correctamente."}
