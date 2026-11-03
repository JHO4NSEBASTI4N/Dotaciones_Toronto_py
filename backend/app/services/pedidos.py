from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import Conflicto, NoEncontrado, ReglaNegocio
from app.models.detalle_carrito import DetalleCarrito
from app.models.pedido import Pedido
from app.models.producto import Producto
from app.repositories.carrito import CarritoRepositorio
from app.repositories.descuento import DescuentoRepositorio
from app.repositories.inventario import InventarioRepositorio
from app.repositories.pedido import PedidoRepositorio
from app.repositories.producto import ProductoRepositorio
from app.schemas.pedido import TRANSICIONES
from app.services.carrito import cerrar_carrito
from app.services.venta import crear_desde_pedido
from app.services.descuento import calcular_precio_final


CERO = Decimal("0.00")
ESTADO_INICIAL = "Pendiente"
ESTADO_ENTREGADO = "Entregado"


def _obtener_o_fallar(repo: PedidoRepositorio, id_pedido: int) -> Pedido:
    pedido = repo.buscar_por_id(id_pedido)
    if pedido is None:
        raise NoEncontrado(f"No existe el pedido con id {id_pedido}")
    return pedido


def _precio_congelado(sesion: Session, producto: Producto):
    descuento = DescuentoRepositorio(sesion).buscar_activo_por_producto(
        producto.id_producto
    )
    return calcular_precio_final(producto.precio, descuento)


def _stock_disponible(repo: CarritoRepositorio, id_producto: int) -> int | None:
    return repo.stock_disponible(id_producto)


def _validar_stock_de_lineas(
    sesion: Session, lineas: list[DetalleCarrito]
) -> None:
    repo = CarritoRepositorio(sesion)

    for linea in lineas:
        disponible = _stock_disponible(repo, linea.id_producto_fk)

        if disponible is None:
            continue

        if (linea.cantidad or 0) > disponible:
            producto = ProductoRepositorio(sesion).buscar_por_id(
                linea.id_producto_fk
            )
            nombre = producto.nombre if producto else linea.id_producto_fk

            raise ReglaNegocio(
                f"Stock insuficiente de '{nombre}': hay {disponible} unidades "
                f"y se piden {linea.cantidad}"
            )


def _descontar_inventario(
    sesion: Session,
    id_producto: int,
    cantidad: int,
    motivo: str,
    usuario_responsable: str | None,
) -> None:
    repo = InventarioRepositorio(sesion)
    filas = repo.listar_por_producto(id_producto)

    disponible = sum(fila.cantidad_actual or 0 for fila in filas)

    if cantidad > disponible:
        raise ReglaNegocio(
            f"Stock insuficiente: hay {disponible} unidades y se piden {cantidad}"
        )

    producto = ProductoRepositorio(sesion).buscar_por_id(id_producto)
    restante = cantidad

    for fila in filas:
        if restante <= 0:
            break

        actual = fila.cantidad_actual or 0

        if actual <= 0:
            continue

        descontar = min(actual, restante)
        fila.cantidad_actual = actual - descontar
        restante -= descontar

        repo.registrar_movimiento(
            id_inventario=fila.id_inventario,
            nombre_producto=producto.nombre if producto else None,
            tipo="SALIDA",
            cantidad=descontar,
            motivo=motivo,
            usuario_responsable=usuario_responsable,
        )

        if (
            (fila.cantidad_actual or 0) <= (fila.stock_minimo or 0)
            and fila.id_producto_fk is not None
            and repo.alerta_vigente(fila.id_producto_fk) is None
        ):
            repo.crear_alerta(
                fila.id_producto_fk,
                fila.cantidad_actual or 0
            )

    sesion.flush()


def _armar_respuesta(sesion: Session, pedido: Pedido) -> dict:
    items: list[dict] = []
    total_unidades = 0
    subtotal_lista = CERO
    descuento_total = CERO
    total = CERO

    for detalle in PedidoRepositorio(sesion).listar_detalles(
        pedido.id_pedido
    ):
        producto = ProductoRepositorio(sesion).buscar_por_id(
            detalle.id_producto_fk
        )

        cantidad = detalle.cantidad or 0
        final = detalle.precio_unitario or CERO

        lista = (
            detalle.precio_lista
            if detalle.precio_lista is not None
            else final
        )

        rebaja = detalle.descuento_unitario or CERO

        items.append(
            {
                "id_detalle_pedido": detalle.id_detalle_pedido,
                "id_producto": detalle.id_producto_fk,
                "nombre_producto": producto.nombre if producto else None,
                "cantidad": cantidad,
                "precio_lista": lista,
                "descuento_unitario": rebaja,
                "precio_unitario": final,
                "subtotal_lista": lista * cantidad,
                "descuento_total": rebaja * cantidad,
                "subtotal": final * cantidad,
            }
        )

        total_unidades += cantidad
        subtotal_lista += lista * cantidad
        descuento_total += rebaja * cantidad
        total += final * cantidad

    return {
        "id_pedido": pedido.id_pedido,
        "id_usuario_fk": pedido.id_usuario_fk,
        "fecha_pedido": pedido.fecha_pedido,
        "estado": pedido.estado,
        "oculto": pedido.oculto,
        "items": items,
        "total_unidades": total_unidades,
        "subtotal_lista": subtotal_lista,
        "descuento_total": descuento_total,
        "total": total,
    }


def crear_desde_carrito(sesion: Session, id_usuario: int) -> dict:
    carrito_repo = CarritoRepositorio(sesion)
    carrito = carrito_repo.buscar_activo_de_usuario(id_usuario)

    if carrito is None:
        raise ReglaNegocio(
            "No tiene un carrito abierto: agregue productos primero"
        )

    lineas = carrito_repo.listar_detalles(carrito.id_carrito)

    if not lineas:
        raise ReglaNegocio(
            "El carrito esta vacio: no hay nada que pedir"
        )

    _validar_stock_de_lineas(sesion, lineas)

    repo = PedidoRepositorio(sesion)
    pedido = repo.crear(id_usuario, ESTADO_INICIAL)

    for linea in lineas:
        producto = ProductoRepositorio(sesion).buscar_por_id(
            linea.id_producto_fk
        )

        if producto is None:
            raise ReglaNegocio(
                f"El producto {linea.id_producto_fk} del carrito ya no existe"
            )

        if producto.inhabilitado:
            raise ReglaNegocio(
                f"El producto '{producto.nombre}' fue inhabilitado: "
                "retirelo del carrito antes de finalizar"
            )

        lista, rebaja, final = _precio_congelado(sesion, producto)

        repo.crear_detalle(
            id_pedido=pedido.id_pedido,
            id_producto=producto.id_producto,
            cantidad=linea.cantidad or 0,
            precio_lista=lista,
            descuento_unitario=rebaja,
            precio_unitario=final,
        )

    cerrar_carrito(sesion, carrito)

    sesion.commit()
    sesion.refresh(pedido)

    return _armar_respuesta(sesion, pedido)


def listar_pedidos(
    sesion: Session,
    saltar: int = 0,
    limite: int = 20,
    id_usuario: int | None = None,
    estado: str | None = None,
    incluir_ocultos: bool = True,
) -> tuple[list[dict], int]:

    repo = PedidoRepositorio(sesion)

    pedidos = repo.listar(
        saltar=saltar,
        limite=limite,
        id_usuario=id_usuario,
        estado=estado,
        incluir_ocultos=incluir_ocultos,
    )

    total = repo.contar(
        id_usuario=id_usuario,
        estado=estado,
        incluir_ocultos=incluir_ocultos,
    )

    return [_armar_respuesta(sesion, p) for p in pedidos], total


def obtener_pedido(sesion: Session, id_pedido: int) -> dict:
    return _armar_respuesta(
        sesion,
        _obtener_o_fallar(
            PedidoRepositorio(sesion),
            id_pedido
        )
    )


def cambiar_estado(
    sesion: Session,
    id_pedido: int,
    nuevo_estado: str,
    usuario_responsable: str | None = None,
) -> dict:

    repo = PedidoRepositorio(sesion)
    pedido = _obtener_o_fallar(repo, id_pedido)

    actual = pedido.estado or ESTADO_INICIAL

    if nuevo_estado == actual:
        raise Conflicto(
            f"El pedido ya esta en estado '{actual}'"
        )

    permitidos = TRANSICIONES.get(actual, set())

    if nuevo_estado not in permitidos:
        if not permitidos:
            raise Conflicto(
                f"El pedido esta en estado final '{actual}': ya no puede cambiar"
            )

        raise ReglaNegocio(
            f"No se puede pasar de '{actual}' a '{nuevo_estado}'. "
            f"Transiciones permitidas: {', '.join(sorted(permitidos))}"
        )

    if nuevo_estado == ESTADO_ENTREGADO:

        for detalle in repo.listar_detalles(pedido.id_pedido):
            _descontar_inventario(
                sesion,
                detalle.id_producto_fk,
                detalle.cantidad or 0,
                motivo=f"Pedido #{pedido.id_pedido} entregado",
                usuario_responsable=usuario_responsable,
            )

        crear_desde_pedido(sesion, pedido)
        repo.ocultar(pedido)

    repo.actualizar_estado(pedido, nuevo_estado)

    sesion.commit()
    sesion.refresh(pedido)

    return _armar_respuesta(sesion, pedido)


def cancelar_pedido(
    sesion: Session,
    id_pedido: int,
    usuario_responsable: str | None = None
) -> dict:

    return cambiar_estado(
        sesion,
        id_pedido,
        "Cancelado",
        usuario_responsable
    )


def es_del_usuario(
    sesion: Session,
    id_pedido: int,
    id_usuario: int
) -> bool:

    pedido = PedidoRepositorio(sesion).buscar_por_id(id_pedido)

    return (
        pedido is not None
        and pedido.id_usuario_fk == id_usuario
    )


def es_cancelable_por_cliente(
    sesion: Session,
    id_pedido: int,
    id_usuario: int
) -> bool:

    pedido = PedidoRepositorio(sesion).buscar_por_id(id_pedido)

    if pedido is None or pedido.id_usuario_fk != id_usuario:
        return False

    return (pedido.estado or ESTADO_INICIAL) == ESTADO_INICIAL