"""Servicio de ventas y facturas. Logica pura + SQLAlchemy, sin FastAPI.

Reglas de negocio implementadas aqui:

  - La venta **solo se genera automaticamente** al entregar un pedido,
    replicando `generarVentaDesdePedido()` del proyecto Java.
  - Es **idempotente**: si el pedido ya tiene venta, se devuelve la existente.
    Entregar dos veces no puede generar dos ventas.
  - La venta **copia** los precios de `detalle_pedido`; nunca los recalcula.
    Asi el descuento aplicado en el pedido queda intacto en la factura.
  - Al crear la venta se emite la **factura** con el total de la venta.
  - Nada se borra: anular una venta cambia su estado a 'Anulada' y anula
    tambien su factura. Las lineas se conservan.
"""

from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import Conflicto, NoEncontrado, ReglaNegocio
from app.models.pedido import Pedido
from app.models.venta import Venta
from app.repositories.pedido import PedidoRepositorio
from app.repositories.producto import ProductoRepositorio
from app.repositories.venta import VentaRepositorio

CERO = Decimal("0.00")
CENTAVO = Decimal("0.01")

ESTADO_COMPLETADA = "Completada"
ESTADO_ANULADA = "Anulada"


def _centavos(valor: Decimal | float | None) -> Decimal:
    """Redondeo comercial a 2 decimales.

    Hace falta porque `venta.total_pagado` es `double` en la base y puede
    arrastrar ruido de coma flotante (54000.000000000004).
    """
    if valor is None:
        return CERO
    return Decimal(str(valor)).quantize(CENTAVO, rounding=ROUND_HALF_UP)


def _obtener_o_fallar(repo: VentaRepositorio, id_venta: int) -> Venta:
    venta = repo.buscar_por_id(id_venta)
    if venta is None:
        raise NoEncontrado(f"No existe la venta con id {id_venta}")
    return venta


# --- creacion automatica desde el pedido ---------------------------------------

def crear_desde_pedido(sesion: Session, pedido: Pedido) -> Venta:
    """Genera la venta (y su factura) a partir de un pedido entregado.

    IDEMPOTENTE: si el pedido ya tiene venta, devuelve esa y no crea nada.
    No hace commit: lo cierra quien llama (la entrega del pedido es atomica).
    """
    repo = VentaRepositorio(sesion)

    existente = repo.buscar_por_pedido(pedido.id_pedido)
    if existente is not None:
        return existente

    detalles = PedidoRepositorio(sesion).listar_detalles(pedido.id_pedido)
    if not detalles:
        raise ReglaNegocio(
            f"El pedido {pedido.id_pedido} no tiene lineas: no se puede facturar"
        )

    total = CERO
    for detalle in detalles:
        if detalle.precio_unitario is not None and detalle.cantidad is not None:
            total += detalle.precio_unitario * detalle.cantidad
    total = _centavos(total)

    venta = repo.crear(
        id_usuario=pedido.id_usuario_fk,
        id_pedido=pedido.id_pedido,
        total_pagado=total,
        estado=ESTADO_COMPLETADA,
    )

    # La venta COPIA los precios congelados del pedido: no se recalcula nada.
    for detalle in detalles:
        repo.crear_detalle(
            id_venta=venta.id_venta,
            id_producto=detalle.id_producto_fk,
            cantidad=detalle.cantidad or 0,
            precio_lista=detalle.precio_lista,
            descuento_unitario=detalle.descuento_unitario or CERO,
            precio_unitario=detalle.precio_unitario or CERO,
        )

    repo.crear_factura(venta.id_venta, total)
    return venta


# --- consultas ----------------------------------------------------------------

def _armar_respuesta(sesion: Session, venta: Venta) -> dict:
    """Calcula los subtotales a partir de lo guardado (no recalcula precios)."""
    repo = VentaRepositorio(sesion)

    items: list[dict] = []
    total_unidades = 0
    subtotal_lista = CERO
    descuento_total = CERO
    total = CERO

    for detalle in repo.listar_detalles(venta.id_venta):
        producto = ProductoRepositorio(sesion).buscar_por_id(detalle.id_producto_fk)
        cantidad = detalle.cantidad or 0
        final = detalle.precio_unitario or CERO
        # Ventas viejas del dump no tienen precio_lista: se usa el final.
        lista = detalle.precio_lista if detalle.precio_lista is not None else final
        rebaja = detalle.descuento_unitario or CERO

        items.append(
            {
                "id_detalle_venta": detalle.id_detalle_venta,
                "id_producto": detalle.id_producto_fk,
                "nombre_producto": producto.nombre if producto else None,
                "cantidad": cantidad,
                "precio_lista": lista,
                "descuento_unitario": rebaja,
                "precio_unitario": final,
                "subtotal_lista": lista * cantidad,
                "descuento_total": rebaja * cantidad,
                "subtotal": final * cantidad,
                "cantidad_devuelta": repo.cantidad_devuelta(detalle.id_detalle_venta),
            }
        )
        total_unidades += cantidad
        subtotal_lista += lista * cantidad
        descuento_total += rebaja * cantidad
        total += final * cantidad

    factura = repo.buscar_factura_de_venta(venta.id_venta)

    return {
        "id_venta": venta.id_venta,
        "id_usuario_fk": venta.id_usuario_fk,
        "id_pedido_fk": venta.id_pedido_fk,
        "fecha_venta": venta.fecha_venta,
        "estado": venta.estado or ESTADO_COMPLETADA,
        "items": items,
        "factura": (
            {
                "id_factura": factura.id_factura,
                "id_venta_fk": factura.id_venta_fk,
                "total_factura": factura.total_factura or CERO,
                "fecha_factura": factura.fecha_factura,
                "estado": factura.estado,
            }
            if factura is not None
            else None
        ),
        "total_unidades": total_unidades,
        "subtotal_lista": subtotal_lista,
        "descuento_total": descuento_total,
        # total_pagado guardado en la base (redondeado): debe coincidir con `total`.
        "total_pagado": _centavos(venta.total_pagado),
    }


def listar_ventas(
    sesion: Session,
    saltar: int = 0,
    limite: int = 20,
    id_usuario: int | None = None,
    estado: str | None = None,
    id_pedido: int | None = None,
) -> tuple[list[dict], int]:
    repo = VentaRepositorio(sesion)
    ventas = repo.listar(
        saltar=saltar,
        limite=limite,
        id_usuario=id_usuario,
        estado=estado,
        id_pedido=id_pedido,
    )
    total = repo.contar(id_usuario=id_usuario, estado=estado, id_pedido=id_pedido)
    return [_armar_respuesta(sesion, v) for v in ventas], total


def obtener_venta(sesion: Session, id_venta: int) -> dict:
    return _armar_respuesta(
        sesion, _obtener_o_fallar(VentaRepositorio(sesion), id_venta)
    )


def obtener_factura(sesion: Session, id_venta: int) -> dict:
    """La factura de una venta (404 si todavia no se emitio)."""
    venta = _obtener_o_fallar(VentaRepositorio(sesion), id_venta)
    factura = VentaRepositorio(sesion).buscar_factura_de_venta(venta.id_venta)
    if factura is None:
        raise NoEncontrado(f"La venta {id_venta} no tiene factura emitida")
    return {
        "id_factura": factura.id_factura,
        "id_venta_fk": factura.id_venta_fk,
        "total_factura": factura.total_factura or CERO,
        "fecha_factura": factura.fecha_factura,
        "estado": factura.estado,
    }


# --- anulacion ----------------------------------------------------------------

def anular_venta(sesion: Session, id_venta: int) -> dict:
    """Anula la venta y su factura. NO borra nada.

    El inventario NO se devuelve aqui: eso corresponde al modulo de
    devoluciones, que registra el motivo y la cantidad real devuelta.
    """
    repo = VentaRepositorio(sesion)
    venta = _obtener_o_fallar(repo, id_venta)

    if (venta.estado or ESTADO_COMPLETADA) == ESTADO_ANULADA:
        raise Conflicto("La venta ya esta anulada")

    repo.anular(venta)
    factura = repo.buscar_factura_de_venta(venta.id_venta)
    if factura is not None and factura.estado != ESTADO_ANULADA:
        repo.anular_factura(factura)

    sesion.commit()
    sesion.refresh(venta)
    return _armar_respuesta(sesion, venta)


def es_del_usuario(sesion: Session, id_venta: int, id_usuario: int) -> bool:
    venta = VentaRepositorio(sesion).buscar_por_id(id_venta)
    return venta is not None and venta.id_usuario_fk == id_usuario
