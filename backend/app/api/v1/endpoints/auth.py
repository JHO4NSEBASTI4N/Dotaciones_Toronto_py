from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import ValidationError

from app.core.dependencies import SesionBD, UsuarioActual
from app.core.exceptions import NoAutorizado
from app.schemas.usuario import LoginEntrada, TokenSalida, UsuarioCrear, UsuarioRespuesta
from app.services import auth as servicio

router = APIRouter()


@router.post("/registro", response_model=UsuarioRespuesta, status_code=status.HTTP_201_CREATED)
def registro(datos: UsuarioCrear, sesion: SesionBD):
    """Registra un cliente nuevo."""
    return servicio.registrar(sesion, datos)


@router.post("/login", response_model=TokenSalida)
def login(credenciales: LoginEntrada, sesion: SesionBD):
    """Login por JSON: devuelve un JWT."""
    usuario = servicio.autenticar(sesion, credenciales)
    return servicio.generar_token(usuario)


@router.post("/token", response_model=TokenSalida, include_in_schema=False)
def token_oauth2(
    sesion: SesionBD,
    formulario: OAuth2PasswordRequestForm = Depends(),
):
    """Login compatible con el boton Authorize de /docs (form-urlencoded).

    El campo `username` del formulario OAuth2 no viene validado: si no es un
    correo valido, Pydantic lanzaria ValidationError y el cliente recibiria un
    500 en vez de un 401. Se traduce a NoAutorizado.
    """
    try:
        credenciales = LoginEntrada(
            correo=formulario.username, password=formulario.password
        )
    except ValidationError:
        raise NoAutorizado("Correo o contrasena incorrectos")

    usuario = servicio.autenticar(sesion, credenciales)
    return servicio.generar_token(usuario)


@router.get("/yo", response_model=UsuarioRespuesta)
def perfil(usuario: UsuarioActual):
    """Datos del usuario autenticado."""
    return usuario