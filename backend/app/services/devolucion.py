from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import Conflicto, NoEncontrado, ReglaNegocio
from app.models.devolucion import Devolucion
from app.repositories.devolucion import DevolucionRepositorio
from app.repositories.producto import ProductoRepositorio
from app.schemas.devolucion import (
    ESTADO_APROBADA,
    ESTADO_PENDIENTE,
    ESTADO_RECHAZADA,
    ESTADOS_VALIDOS,
)

CERO = Decimal("0.00")
CENTAVO = Decimal("0.01")

ESTADO_VENTA_COMPLETADA = "Completada"
ESTADO_VENTA_ANULADA = "Anulada"


def _centavos(valor: Decimal | float | None) -> Decimal:
    """Redondeo comercial a 2 decimales (mismo criterio que ventas)."""
    if valor is None:
        return CERO
    return Decimal(str(valor)).quantize(CENTAVO, rounding=ROUND_HALF_UP)


def _obtener_o_fallar(repo: DevolucionRepositorio, id_devolucion: int) -> Devolucion:
    devolucion = repo.buscar_por_id(id_devolucion)
    if devolucion is None:
        raise NoEncontrado(f"No existe la devolucion con id {id_devolucion}")
    return devolucion


def _armar_respuesta(sesion: Session, devolucion: Devolucion) -> dict:
    """Agrega el contexto de la venta para no obligar a consultarla aparte."""
    repo = DevolucionRepositorio(sesion)
    detalle = repo.buscar_detalle(devolucion.id_detalle_venta_fk or 0)

    cantidad_vendida = 0
    cantidad_aprobada = 0
    valor_unitario = CERO
    id_venta = None
    id_producto = None
    nombre_producto = None

    if detalle is not None:
        cantidad_vendida = detalle.cantidad or 0
        cantidad_aprobada = repo.cantidad_aprobada(detalle.id_detalle_venta)
        valor_unitario = detalle.precio_unitario or CERO
        id_venta = detalle.id_venta_fk
        id_producto = detalle.id_producto_fk
        producto = ProductoRepositorio(sesion).buscar_por_id(detalle.id_producto_fk)
        nombre_producto = producto.nombre if producto else None

    cantidad = devolucion.cantidad or 0

    return {
        "id_devolucion": devolucion.id_devolucion,
        "id_detalle_venta_fk": devolucion.id_detalle_venta_fk,
        "cantidad": cantidad,
        "motivo": devolucion.motivo,
        "fecha_devolucion": devolucion.fecha_devolucion,
        "estado": devolucion.estado or ESTADO_PENDIENTE,
        "id_venta": id_venta,
        "id_producto": id_producto,
        "nombre_producto": nombre_producto,
        "cantidad_vendida": cantidad_vendida,
        # Lo realmente aceptado como devuelto (solo Aprobadas).
        "cantidad_devuelta": cantidad_aprobada,
        # Cupo que le queda al cliente en esa linea.
        "cantidad_disponible": max(cantidad_vendida - cantidad_aprobada, 0),
        "valor_unitario": str(_centavos(valor_unitario)),
        "valor_devuelto": str(_centavos(valor_unitario * cantidad)),
    }


# --- operaciones ---------------------------------------------------------------

def crear_devolucion(
    sesion: Session,
    id_detalle_venta: int,
    cantidad: int,
    motivo: str,
) -> dict:
    """Registra una solicitud de devolucion en estado Pendiente."""
    repo = DevolucionRepositorio(sesion)

    detalle = repo.buscar_detalle(id_detalle_venta)
    if detalle is None:
        raise NoEncontrado(
            f"No existe la linea de venta con id {id_detalle_venta}"
        )

    venta = repo.buscar_venta(detalle.id_venta_fk) if detalle.id_venta_fk else None
    if venta is None:
        raise NoEncontrado("La linea de venta no pertenece a ninguna venta")

    if (venta.estado or ESTADO_VENTA_COMPLETADA) == ESTADO_VENTA_ANULADA:
        raise Conflicto(
            f"La venta {venta.id_venta} esta anulada: no admite devoluciones"
        )

    vendidas = detalle.cantidad or 0
    comprometidas = repo.cantidad_comprometida(id_detalle_venta)

    if vendidas <= 0:
        raise ReglaNegocio("Esa linea de venta no tiene unidades para devolver")

    if cantidad > (vendidas - comprometidas):
        raise ReglaNegocio(
            f"No se puede devolver {cantidad}: de esa linea se vendieron "
            f"{vendidas} y ya hay {comprometidas} en tramite o aprobadas "
            f"(disponible: {vendidas - comprometidas})"
        )

    devolucion = repo.crear(
        id_detalle_venta=id_detalle_venta,
        cantidad=cantidad,
        motivo=motivo,
        estado=ESTADO_PENDIENTE,
    )
    sesion.commit()
    sesion.refresh(devolucion)
    return _armar_respuesta(sesion, devolucion)


def listar_devoluciones(
    sesion: Session,
    saltar: int = 0,
    limite: int = 20,
    id_usuario: int | None = None,
    estado: str | None = None,
    id_detalle_venta: int | None = None,
) -> tuple[list[dict], int]:
    repo = DevolucionRepositorio(sesion)
    if estado is not None and estado not in ESTADOS_VALIDOS:
        raise ReglaNegocio(
            f"Estado invalido '{estado}'. Use: {', '.join(sorted(ESTADOS_VALIDOS))}"
        )
    devoluciones = repo.listar(
        saltar=saltar,
        limite=limite,
        id_usuario=id_usuario,
        estado=estado,
        id_detalle_venta=id_detalle_venta,
    )
    total = repo.contar(
        id_usuario=id_usuario, estado=estado, id_detalle_venta=id_detalle_venta
    )
    return [_armar_respuesta(sesion, d) for d in devoluciones], total


def obtener_devolucion(sesion: Session, id_devolucion: int) -> dict:
    return _armar_respuesta(
        sesion, _obtener_o_fallar(DevolucionRepositorio(sesion), id_devolucion)
    )


def cambiar_estado(sesion: Session, id_devolucion: int, nuevo_estado: str) -> dict:
    """Aprueba o rechaza una devolucion. NO toca el inventario (ver regla 6)."""
    repo = DevolucionRepositorio(sesion)
    devolucion = _obtener_o_fallar(repo, id_devolucion)

    if nuevo_estado not in (ESTADO_APROBADA, ESTADO_RECHAZADA):
        raise ReglaNegocio(
            f"Solo se puede pasar a '{ESTADO_APROBADA}' o '{ESTADO_RECHAZADA}'"
        )

    actual = devolucion.estado or ESTADO_PENDIENTE
    if actual != ESTADO_PENDIENTE:
        raise Conflicto(
            f"La devolucion ya esta en estado '{actual}' y no se puede cambiar"
        )

    repo.cambiar_estado(devolucion, nuevo_estado)
    sesion.commit()
    sesion.refresh(devolucion)
    return _armar_respuesta(sesion, devolucion)


def aprobar(sesion: Session, id_devolucion: int) -> dict:
    return cambiar_estado(sesion, id_devolucion, ESTADO_APROBADA)


def rechazar(sesion: Session, id_devolucion: int) -> dict:
    return cambiar_estado(sesion, id_devolucion, ESTADO_RECHAZADA)


def es_del_usuario(sesion: Session, id_devolucion: int, id_usuario: int) -> bool:
    """El cliente solo ve las devoluciones de sus propias ventas."""
    repo = DevolucionRepositorio(sesion)
    devolucion = repo.buscar_por_id(id_devolucion)
    if devolucion is None:
        return False
    detalle = repo.buscar_detalle(devolucion.id_detalle_venta_fk or 0)
    if detalle is None or detalle.id_venta_fk is None:
        return False
    venta = repo.buscar_venta(detalle.id_venta_fk)
    return venta is not None and venta.id_usuario_fk == id_usuario


def es_del_usuario_por_linea(
    sesion: Session, id_detalle_venta: int, id_usuario: int
) -> bool:
    repo = DevolucionRepositorio(sesion)
    detalle = repo.buscar_detalle(id_detalle_venta)
    if detalle is None or detalle.id_venta_fk is None:
        return False
    venta = repo.buscar_venta(detalle.id_venta_fk)
    return venta is not None and venta.id_usuario_fk == id_usuario