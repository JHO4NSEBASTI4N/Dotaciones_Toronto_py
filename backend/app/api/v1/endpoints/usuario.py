"""Endpoints de gestion de usuarios.

Lo que puede hacer el ADMINISTRADOR: listar, ver, editar, inhabilitar,
habilitar y restablecer la contrasena de cualquier usuario.

Lo que puede hacer cualquier usuario con su propia cuenta: verla, editarla y
cambiar su contrasena (`POST /auth/cambiar-password`, en el router de auth).

No hay DELETE: la baja de un usuario es `estado = "Inhabilitado"`.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import (
    ROL_ADMINISTRADOR,
    SesionBD,
    UsuarioActual,
    requiere_rol,
)
from app.core.exceptions import Prohibido
from app.core.pagination import PaginaRespuesta, ParametrosPaginacion
from app.schemas.usuario import (
    RestablecerPasswordEntrada,
    UsuarioActualizar,
    UsuarioDetalleRespuesta,
)
from app.services import usuario as servicio

router = APIRouter()

# Todo el router es solo para el administrador.
SoloAdmin = Depends(requiere_rol(ROL_ADMINISTRADOR))


def _detalle(usuario) -> UsuarioDetalleRespuesta:
    """Pasa el modelo a la respuesta agregando los roles activos."""
    respuesta = UsuarioDetalleRespuesta.model_validate(usuario)
    respuesta.roles_activos = servicio.roles_de_usuario(usuario)
    return respuesta


@router.get(
    "",
    response_model=PaginaRespuesta[UsuarioDetalleRespuesta],
    dependencies=[SoloAdmin],
)
def listar(
    sesion: SesionBD,
    paginacion: ParametrosPaginacion = Depends(),
    correo: Optional[str] = Query(None, description="Busqueda parcial por correo"),
    nombre: Optional[str] = Query(None, description="Busqueda parcial por nombre"),
    estado: Optional[str] = Query(None, description="Habilitado o Inhabilitado"),
    id_rol: Optional[int] = Query(None, description="Usuarios que tengan ese rol"),
):
    """Listado paginado y filtrable. Solo Administrador."""
    items, total = servicio.listar_usuarios(
        sesion,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        correo=correo,
        nombre=nombre,
        estado=estado,
        id_rol=id_rol,
    )
    return PaginaRespuesta[UsuarioDetalleRespuesta](
        total=total,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        items=[_detalle(u) for u in items],
    )


@router.get("/{id_usuario}", response_model=UsuarioDetalleRespuesta)
def detalle(id_usuario: int, sesion: SesionBD, usuario: UsuarioActual):
    """Ficha de un usuario. La puede ver el administrador o el propio usuario."""
    consultado = servicio.obtener_usuario(sesion, id_usuario)

    es_admin = ROL_ADMINISTRADOR in servicio.roles_de_usuario(usuario)
    if consultado.id_usuario != usuario.id_usuario and not es_admin:
        raise Prohibido("Solo puede consultar sus propios datos")

    return _detalle(consultado)


@router.patch("/{id_usuario}", response_model=UsuarioDetalleRespuesta)
def actualizar(
    id_usuario: int,
    datos: UsuarioActualizar,
    sesion: SesionBD,
    usuario: UsuarioActual,
):
    """Edita nombre, documento, telefono y direccion.

    El estado y los roles NO se cambian por aqui: tienen sus propios endpoints.
    El correo tampoco (es con lo que se inicia sesion).
    """
    actualizado = servicio.actualizar_usuario(sesion, id_usuario, datos, usuario)
    return _detalle(actualizado)


@router.post(
    "/{id_usuario}/inhabilitar",
    response_model=UsuarioDetalleRespuesta,
)
def inhabilitar(id_usuario: int, sesion: SesionBD, usuario: UsuarioActual):
    """Baja logica. Requiere Administrador.

    Un administrador no puede inhabilitarse a si mismo, ni puede dejar al
    sistema sin ningun administrador habilitado.
    """
    # Se valida aqui (y no solo con la dependencia) para poder comparar con
    # el id del solicitante dentro del servicio.
    if ROL_ADMINISTRADOR not in servicio.roles_de_usuario(usuario):
        raise Prohibido(
            "No tiene el rol requerido para esta operacion con el rol "
            "con el que inicio sesion"
        )

    return _detalle(servicio.inhabilitar_usuario(sesion, id_usuario, usuario))


@router.post(
    "/{id_usuario}/habilitar",
    response_model=UsuarioDetalleRespuesta,
    dependencies=[SoloAdmin],
)
def habilitar(id_usuario: int, sesion: SesionBD):
    """Vuelve a habilitar un usuario."""
    return _detalle(servicio.habilitar_usuario(sesion, id_usuario))


@router.post(
    "/{id_usuario}/restablecer-password",
    response_model=UsuarioDetalleRespuesta,
    dependencies=[SoloAdmin],
)
def restablecer_password(
    id_usuario: int, datos: RestablecerPasswordEntrada, sesion: SesionBD
):
    """Le pone una contrasena nueva al usuario. Requiere Administrador.

    No devuelve la contrasena: la respuesta es la ficha del usuario.
    """
    return _detalle(
        servicio.restablecer_password(sesion, id_usuario, datos.password_nueva)
    )
