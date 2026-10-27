from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from decimal import Decimal

from app.core.dependencies import ROL_ADMINISTRADOR, SesionBD, requiere_rol
from app.core.pagination import PaginaRespuesta, ParametrosPaginacion
from app.schemas.descuento import (
    DescuentoActualizar,
    DescuentoCrear,
    DescuentoRespuesta,
)
from app.services import descuento as servicio

router = APIRouter()

# Los descuentos mueven el precio de venta: solo el administrador los toca.
SoloAdministrador = Depends(requiere_rol(ROL_ADMINISTRADOR))


class DescuentoVigenteRespuesta(BaseModel):
    """Descuento activo de un producto + el precio ya resuelto."""

    descuento: DescuentoRespuesta
    precio_lista: Decimal
    descuento_unitario: Decimal
    precio_unitario: Decimal


@router.get("", response_model=PaginaRespuesta[DescuentoRespuesta])
def listar(
    sesion: SesionBD,
    paginacion: ParametrosPaginacion = Depends(),
    id_producto: Optional[int] = Query(None, description="Filtra por producto"),
    tipo_descuento: Optional[str] = Query(None, description="PORCENTAJE o FIJO"),
    activo: Optional[bool] = Query(None, description="true = vigentes"),
):
    """Listado paginado de descuentos. Publico (no requiere token)."""
    items, total = servicio.listar_descuentos(
        sesion,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        id_producto=id_producto,
        tipo_descuento=tipo_descuento,
        activo=activo,
    )
    return PaginaRespuesta[DescuentoRespuesta](
        total=total,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        items=[DescuentoRespuesta.model_validate(d) for d in items],
    )


@router.get(
    "/producto/{id_producto}", response_model=DescuentoVigenteRespuesta
)
def vigente_de_producto(id_producto: int, sesion: SesionBD):
    """Descuento activo del producto y cuanto queda el precio final. Publico.

    Es el endpoint que usara el carrito para saber que cobrar.
    """
    resultado = servicio.obtener_vigente_de_producto(sesion, id_producto)
    return DescuentoVigenteRespuesta(
        descuento=DescuentoRespuesta.model_validate(resultado["descuento"]),
        precio_lista=resultado["precio_lista"],
        descuento_unitario=resultado["descuento_unitario"],
        precio_unitario=resultado["precio_unitario"],
    )


@router.get("/{id_descuento}", response_model=DescuentoRespuesta)
def detalle(id_descuento: int, sesion: SesionBD):
    """Detalle de un descuento. Publico."""
    return servicio.obtener_descuento(sesion, id_descuento)


@router.post(
    "",
    response_model=DescuentoRespuesta,
    status_code=status.HTTP_201_CREATED,
    dependencies=[SoloAdministrador],
)
def crear(datos: DescuentoCrear, sesion: SesionBD):
    """Crea un descuento activo. Requiere rol Administrador.

    Si el producto ya tenia un descuento activo, ese pasa a inactivo:
    un producto nunca queda con dos descuentos vigentes a la vez.
    """
    return servicio.crear_descuento(sesion, datos)


@router.patch(
    "/{id_descuento}",
    response_model=DescuentoRespuesta,
    dependencies=[SoloAdministrador],
)
def actualizar(id_descuento: int, datos: DescuentoActualizar, sesion: SesionBD):
    """Actualizacion parcial. Requiere rol Administrador."""
    return servicio.actualizar_descuento(sesion, id_descuento, datos)


@router.post(
    "/{id_descuento}/desactivar",
    response_model=DescuentoRespuesta,
    dependencies=[SoloAdministrador],
)
def desactivar(id_descuento: int, sesion: SesionBD):
    """Desactiva el descuento (activo=False).

    REGLA DEL PROYECTO: no se elimina informacion. No existe DELETE en esta API.
    Un descuento inactivo deja de aplicarse, pero se conserva porque los
    pedidos y facturas ya emitidos lo referencian.
    """
    return servicio.desactivar_descuento(sesion, id_descuento)


@router.post(
    "/{id_descuento}/activar",
    response_model=DescuentoRespuesta,
    dependencies=[SoloAdministrador],
)
def activar(id_descuento: int, sesion: SesionBD):
    """Vuelve a dejar vigente el descuento (apaga el que estuviera activo)."""
    return servicio.activar_descuento(sesion, id_descuento)