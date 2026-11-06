from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from app.core.dependencies import (
    ROL_ADMINISTRADOR,
    ROL_BODEGUERO,
    ROL_VENDEDOR,
    SesionBD,
    UsuarioActual,
    requiere_rol,
    roles_de,
)
from app.core.exceptions import NoEncontrado, Prohibido
from app.core.pagination import PaginaRespuesta, ParametrosPaginacion
from app.schemas.devolucion import (
    DevolucionCrear,
    DevolucionEstadoActualizar,
    DevolucionRespuesta,
)
from app.services import devolucion as servicio

router = APIRouter()

# Aprobar o rechazar una devolucion es cosa de administrador, vendedor o bodega.
PuedeResolver = Depends(requiere_rol(ROL_ADMINISTRADOR, ROL_VENDEDOR, ROL_BODEGUERO))

ROLES_QUE_VEN_TODO = {ROL_ADMINISTRADOR, ROL_VENDEDOR, ROL_BODEGUERO}


def _es_staff(usuario) -> bool:
    return bool(roles_de(usuario) & ROLES_QUE_VEN_TODO)


@router.get("", response_model=PaginaRespuesta[DevolucionRespuesta])
def listar(
    sesion: SesionBD,
    usuario: UsuarioActual,
    paginacion: ParametrosPaginacion = Depends(),
    estado: Optional[str] = Query(
        None, description="Pendiente, Aprobada o Rechazada"
    ),
    id_detalle_venta: Optional[int] = Query(None, description="Filtra por linea de venta"),
):
    """Listado de devoluciones.

    El cliente ve solo las de sus ventas; administrador, vendedor y bodega ven
    todas.
    """
    staff = _es_staff(usuario)
    items, total = servicio.listar_devoluciones(
        sesion,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        id_usuario=None if staff else usuario.id_usuario,
        estado=estado,
        id_detalle_venta=id_detalle_venta,
    )
    return PaginaRespuesta[DevolucionRespuesta](
        total=total,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        items=[DevolucionRespuesta.model_validate(d) for d in items],
    )


@router.get("/{id_devolucion}", response_model=DevolucionRespuesta)
def detalle(id_devolucion: int, sesion: SesionBD, usuario: UsuarioActual):
    """Detalle de una devolucion."""
    if not _es_staff(usuario) and not servicio.es_del_usuario(
        sesion, id_devolucion, usuario.id_usuario
    ):
        raise NoEncontrado(f"No existe la devolucion con id {id_devolucion}")
    return servicio.obtener_devolucion(sesion, id_devolucion)


@router.post("", response_model=DevolucionRespuesta, status_code=status.HTTP_201_CREATED)
def crear(datos: DevolucionCrear, sesion: SesionBD, usuario: UsuarioActual):
    """Solicita una devolucion sobre una linea de una venta.

    Reglas: la venta debe estar Completada, no se puede devolver mas de lo
    vendido en esa linea, y toda devolucion nace en estado 'Pendiente'.
    """
    if not _es_staff(usuario) and not servicio.es_del_usuario_por_linea(
        sesion, datos.id_detalle_venta, usuario.id_usuario
    ):
        raise NoEncontrado(
            f"No existe la linea de venta con id {datos.id_detalle_venta}"
        )
    return servicio.crear_devolucion(
        sesion,
        id_detalle_venta=datos.id_detalle_venta,
        cantidad=datos.cantidad,
        motivo=datos.motivo,
    )


@router.patch(
    "/{id_devolucion}/estado",
    response_model=DevolucionRespuesta,
    dependencies=[PuedeResolver],
)
def cambiar_estado(
    id_devolucion: int, datos: DevolucionEstadoActualizar, sesion: SesionBD
):
    """Aprueba o rechaza una devolucion. Requiere Administrador, Vendedor o Bodeguero.

    OJO: aprobar NO devuelve el stock a la bodega. Solo se le informa al
    cliente que su solicitud fue aceptada; el producto fisico todavia no ha
    llegado. Cuando entre, se registra una ENTRADA por el modulo de inventario.
    """
    if datos.observacion:
        # La observacion es solo informativa: no hay columna en la base para
        # guardarla, asi que se deja fuera del registro a proposito.
        pass
    return servicio.cambiar_estado(sesion, id_devolucion, datos.estado)


@router.post(
    "/{id_devolucion}/aprobar",
    response_model=DevolucionRespuesta,
    dependencies=[PuedeResolver],
)
def aprobar(id_devolucion: int, sesion: SesionBD):
    """Atajo de PATCH /estado con 'Aprobada'."""
    return servicio.aprobar(sesion, id_devolucion)


@router.post(
    "/{id_devolucion}/rechazar",
    response_model=DevolucionRespuesta,
    dependencies=[PuedeResolver],
)
def rechazar(id_devolucion: int, sesion: SesionBD):
    """Atajo de PATCH /estado con 'Rechazada'."""
    return servicio.rechazar(sesion, id_devolucion)