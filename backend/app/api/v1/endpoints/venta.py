from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import (
    ROL_ADMINISTRADOR,
    ROL_VENDEDOR,
    SesionBD,
    UsuarioActual,
    requiere_rol,
    roles_de,
)
from app.core.exceptions import NoEncontrado
from app.core.pagination import PaginaRespuesta, ParametrosPaginacion
from app.schemas.venta import FacturaRespuesta, VentaRespuesta
from app.services import venta as servicio

router = APIRouter()

# Anular una venta (y su factura) es cosa de administrador o vendedor.
PuedeGestionar = Depends(requiere_rol(ROL_ADMINISTRADOR, ROL_VENDEDOR))

ROLES_QUE_VEN_TODO = {ROL_ADMINISTRADOR, ROL_VENDEDOR}


def _es_staff(usuario) -> bool:
    return bool(roles_de(usuario) & ROLES_QUE_VEN_TODO)


@router.get("", response_model=PaginaRespuesta[VentaRespuesta])
def listar(
    sesion: SesionBD,
    usuario: UsuarioActual,
    paginacion: ParametrosPaginacion = Depends(),
    estado: Optional[str] = Query(None, description="Completada o Anulada"),
    id_usuario: Optional[int] = Query(None, description="Solo administrador/vendedor"),
    id_pedido: Optional[int] = Query(None),
):
    """Listado de ventas.

    El cliente ve solo las suyas; administrador y vendedor ven todas.
    """
    staff = _es_staff(usuario)
    items, total = servicio.listar_ventas(
        sesion,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        id_usuario=id_usuario if staff else usuario.id_usuario,
        estado=estado,
        id_pedido=id_pedido,
    )
    return PaginaRespuesta[VentaRespuesta](
        total=total,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        items=[VentaRespuesta.model_validate(v) for v in items],
    )


@router.get("/{id_venta}", response_model=VentaRespuesta)
def detalle(id_venta: int, sesion: SesionBD, usuario: UsuarioActual):
    """Detalle de una venta con sus lineas y su factura."""
    if not _es_staff(usuario) and not servicio.es_del_usuario(
        sesion, id_venta, usuario.id_usuario
    ):
        raise NoEncontrado(f"No existe la venta con id {id_venta}")
    return servicio.obtener_venta(sesion, id_venta)


@router.get("/{id_venta}/factura", response_model=FacturaRespuesta)
def factura(id_venta: int, sesion: SesionBD, usuario: UsuarioActual):
    """Factura de la venta."""
    if not _es_staff(usuario) and not servicio.es_del_usuario(
        sesion, id_venta, usuario.id_usuario
    ):
        raise NoEncontrado(f"No existe la venta con id {id_venta}")
    return servicio.obtener_factura(sesion, id_venta)


@router.post(
    "/{id_venta}/anular",
    response_model=VentaRespuesta,
    dependencies=[PuedeGestionar],
)
def anular(id_venta: int, sesion: SesionBD):
    """Anula la venta y su factura. Requiere Administrador o Vendedor.

    REGLA DEL PROYECTO: no se elimina informacion. La venta queda en estado
    'Anulada' y se conserva con todas sus lineas. El inventario NO se devuelve
    aqui: eso lo hace el modulo de devoluciones con su motivo.
    """
    return servicio.anular_venta(sesion, id_venta)
