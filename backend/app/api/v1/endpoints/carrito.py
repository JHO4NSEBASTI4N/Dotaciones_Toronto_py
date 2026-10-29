from fastapi import APIRouter, status

from app.core.dependencies import SesionBD, UsuarioActual
from app.schemas.carrito import (
    CarritoRespuesta,
    ItemCarritoActualizar,
    ItemCarritoCrear,
)
from app.services import carrito as servicio

router = APIRouter()


@router.get("", response_model=CarritoRespuesta)
def ver(sesion: SesionBD, usuario: UsuarioActual):
    """Carrito abierto del usuario autenticado, con precios y totales al dia.

    Si es la primera vez, se le crea un carrito vacio. Los precios se
    recalculan en cada lectura con el descuento vigente.
    """
    return servicio.ver_carrito(sesion, usuario.id_usuario)


@router.post(
    "/items", response_model=CarritoRespuesta, status_code=status.HTTP_201_CREATED
)
def agregar(datos: ItemCarritoCrear, sesion: SesionBD, usuario: UsuarioActual):
    """Agrega un producto. Si ya estaba, acumula la cantidad.

    Valida que el producto exista, este habilitado y haya stock suficiente.
    """
    return servicio.agregar_item(sesion, usuario.id_usuario, datos)


@router.patch("/items/{id_detalle}", response_model=CarritoRespuesta)
def actualizar(
    id_detalle: int,
    datos: ItemCarritoActualizar,
    sesion: SesionBD,
    usuario: UsuarioActual,
):
    """Fija la cantidad de una linea. Para quitarla use /quitar."""
    return servicio.actualizar_item(
        sesion, usuario.id_usuario, id_detalle, datos.cantidad
    )


@router.post("/items/{id_detalle}/quitar", response_model=CarritoRespuesta)
def quitar(id_detalle: int, sesion: SesionBD, usuario: UsuarioActual):
    """Retira la linea del carrito.

    REGLA DEL PROYECTO: no se elimina informacion. La fila queda con
    inhabilitado=True y no aparece en el carrito.
    """
    return servicio.quitar_item(sesion, usuario.id_usuario, id_detalle)


@router.post("/vaciar", response_model=CarritoRespuesta)
def vaciar(sesion: SesionBD, usuario: UsuarioActual):
    """Vacia el carrito marcando todas las lineas como inhabilitadas."""
    return servicio.vaciar_carrito(sesion, usuario.id_usuario)