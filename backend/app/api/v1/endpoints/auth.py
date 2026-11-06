from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import ValidationError

from app.core.dependencies import SesionBD, UsuarioActual
from app.core.exceptions import NoAutorizado
from app.schemas.usuario import (
    CambiarRolEntrada,
    LoginEntrada,
    MisRolesRespuesta,
    TokenSalida,
    UsuarioCrear,
    UsuarioRespuesta,
)
from app.services import auth as servicio

router = APIRouter()


@router.post("/registro", response_model=UsuarioRespuesta, status_code=status.HTTP_201_CREATED)
def registro(datos: UsuarioCrear, sesion: SesionBD):
    """Registra un cliente nuevo."""
    return servicio.registrar(sesion, datos)


@router.post("/login", response_model=TokenSalida)
def login(credenciales: LoginEntrada, sesion: SesionBD):
    """Login por JSON: devuelve un JWT con el rol elegido.

    Si el usuario tiene varios roles puede mandar `id_rol` para entrar con uno
    concreto. Si no lo manda, entra con su rol por defecto.
    """
    return servicio.iniciar_sesion(sesion, credenciales)


@router.post("/token", response_model=TokenSalida, include_in_schema=False)
def token_oauth2(
    sesion: SesionBD,
    formulario: OAuth2PasswordRequestForm = Depends(),
):
    """Login compatible con el boton Authorize de /docs (form-urlencoded).

    No permite elegir rol: el boton Authorize del Swagger solo envia usuario y
    contrasena, asi que entra con el rol por defecto. Para cambiar de rol se
    usa POST /auth/login con `id_rol` o POST /auth/cambiar-rol.
    """
    try:
        credenciales = LoginEntrada(
            correo=formulario.username, password=formulario.password
        )
    except ValidationError:
        raise NoAutorizado("Correo o contrasena incorrectos")

    return servicio.iniciar_sesion(sesion, credenciales)


@router.get("/yo", response_model=UsuarioRespuesta)
def perfil(usuario: UsuarioActual):
    """Datos del usuario autenticado."""
    return usuario


@router.get("/mis-roles", response_model=MisRolesRespuesta)
def mis_roles(sesion: SesionBD, usuario: UsuarioActual):
    """Roles con los que este usuario puede entrar.

    Es lo que alimenta el boton "cambiar rol": la pantalla que le muestra al
    usuario los roles que tiene para que elija con cual entrar.
    """
    return servicio.mis_roles(sesion, usuario)


@router.post("/cambiar-rol", response_model=TokenSalida)
def cambiar_rol(datos: CambiarRolEntrada, sesion: SesionBD, usuario: UsuarioActual):
    """Emite un token nuevo con otro de los roles del usuario.

    Solo se puede cambiar a un rol que el administrador le haya asignado.
    """
    return servicio.cambiar_rol(sesion, usuario, datos.id_rol)
