from collections import OrderedDict, deque
from threading import Lock
from time import monotonic
from fastapi import APIRouter, HTTPException, Request
from app.core.dependencies import SesionBD
from app.schemas.recuperacion import SolicitudRecuperacion, VerificacionRecuperacion, NuevaPassword
from app.services import recuperacion as servicio

router = APIRouter()
_registros = OrderedDict()
_lock = Lock()

def _limitar(request: Request, accion: str, maximo: int):
    clave = (request.client.host if request.client else 'desconocido', accion)
    ahora = monotonic()
    with _lock:
        if clave not in _registros and len(_registros) >= 10000:
            _registros.popitem(last=False)
        historial = _registros.setdefault(clave, deque())
        _registros.move_to_end(clave)
        while historial and ahora - historial[0] >= 900:
            historial.popleft()
        if len(historial) >= maximo:
            raise HTTPException(status_code=429, detail='Demasiados intentos. Espera unos minutos y vuelve a intentarlo.')
        historial.append(ahora)

@router.post('/solicitar')
def solicitar(datos: SolicitudRecuperacion, request: Request, sesion: SesionBD):
    _limitar(request, 'solicitar', 5)
    servicio.solicitar(sesion, str(datos.correo))
    return {'mensaje': servicio.MENSAJE}

@router.post('/verificar')
def verificar(datos: VerificacionRecuperacion, request: Request, sesion: SesionBD):
    _limitar(request, 'verificar', 20)
    return {'ticket': servicio.verificar(sesion, str(datos.correo), datos.codigo)}

@router.post('/cambiar')
def cambiar(datos: NuevaPassword, request: Request, sesion: SesionBD):
    _limitar(request, 'cambiar', 20)
    servicio.cambiar(sesion, str(datos.correo), datos.ticket, datos.password_nueva)
    return {'mensaje': 'Contraseña actualizada. Ya puedes iniciar sesión.'}
