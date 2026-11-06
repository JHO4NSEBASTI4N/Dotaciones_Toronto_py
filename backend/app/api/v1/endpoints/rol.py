"""Endpoints de roles y multirol.

Todo esto lo maneja el ADMINISTRADOR: es quien decide que roles existen y
quien tiene cuales. No hay DELETE: los roles se desactivan y las asignaciones
se retiran con baja logica.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from app.core.dependencies import (
    ROL_ADMINISTRADOR,
    SesionBD,
    UsuarioActual,
    requiere_rol,
    roles_de,
)
from app.core.exceptions import NoEncontrado, Prohibido
from app.schemas.rol import (
    AsignacionRol,
    RolActualizar,
    RolCrear,
    RolDeUsuarioRespuesta,
    RolesDeUsuarioRespuesta,
    RolRespuesta,
)
from app.services import rol as servicio

router = APIRouter()

SoloAdmin = Depends(requiere_rol(ROL_ADMINISTRADOR))


# --- catalogo de roles ---------------------------------------------------------

@router.get("", response_model=list[RolRespuesta], dependencies=[SoloAdmin])
def listar(sesion: SesionBD, solo_activos: Optional[bool] = Query(None)):
    """Listado de roles. Requiere Administrador."""
    return servicio.listar_roles(sesion, solo_activos=bool(solo_activos))


@router.post(
    "",
    response_model=RolRespuesta,
    status_code=status.HTTP_201_CREATED,
    dependencies=[SoloAdmin],
)
def crear(datos: RolCrear, sesion: SesionBD):
    """Crea un rol nuevo. Requiere Administrador."""
    return servicio.crear_rol(sesion, datos)


@router.get("/{id_rol}", response_model=RolRespuesta, dependencies=[SoloAdmin])
def detalle(id_rol: int, sesion: SesionBD):
    return servicio.obtener_rol(sesion, id_rol)


@router.patch("/{id_rol}", response_model=RolRespuesta, dependencies=[SoloAdmin])
def actualizar(id_rol: int, datos: RolActualizar, sesion: SesionBD):
    """Cambia el nombre o la descripcion del rol."""
    return servicio.actualizar_rol(sesion, id_rol, datos)


@router.post("/{id_rol}/activar", response_model=RolRespuesta, dependencies=[SoloAdmin])
def activar(id_rol: int, sesion: SesionBD):
    return servicio.activar_rol(sesion, id_rol)


@router.post("/{id_rol}/desactivar", response_model=RolRespuesta, dependencies=[SoloAdmin])
def desactivar(id_rol: int, sesion: SesionBD):
    """Desactiva un rol. No lo borra.

    Un rol desactivado deja de poder usarse para iniciar sesion, y no se puede
    desactivar si dejaria a algun usuario sin ningun rol activo.
    """
    return servicio.desactivar_rol(sesion, id_rol)


# --- roles de un usuario -------------------------------------------------------

@router.get(
    "/usuario/{id_usuario}",
    response_model=RolesDeUsuarioRespuesta,
)
def roles_de_usuario(id_usuario: int, sesion: SesionBD, usuario: UsuarioActual):
    """Roles de un usuario.

    Lo puede ver el administrador, o el propio usuario (para pintar el boton
    de cambiar rol).
    """
    es_admin = ROL_ADMINISTRADOR in roles_de(usuario)
    if usuario.id_usuario != id_usuario and not es_admin:
        raise Prohibido("Solo puede consultar sus propios roles")
    return servicio.roles_de_usuario(sesion, id_usuario)


@router.post(
    "/usuario/{id_usuario}/asignar",
    response_model=RolesDeUsuarioRespuesta,
    dependencies=[SoloAdmin],
)
def asignar(id_usuario: int, datos: AsignacionRol, sesion: SesionBD):
    """Le da un rol a un usuario. Con eso podra iniciar sesion con ese rol."""
    return servicio.asignar_rol(sesion, id_usuario, datos)


@router.post(
    "/usuario/{id_usuario}/retirar",
    response_model=RolesDeUsuarioRespuesta,
    dependencies=[SoloAdmin],
)
def retirar(id_usuario: int, datos: AsignacionRol, sesion: SesionBD):
    """Le quita un rol a un usuario (baja logica: la asignacion queda inactiva).

    No se puede retirar el ultimo rol activo: el usuario quedaria sin poder
    iniciar sesion.
    """
    return servicio.retirar_rol(sesion, id_usuario, datos)
