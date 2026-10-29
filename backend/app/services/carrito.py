from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import NoEncontrado, ReglaNegocio
from app.models.carrito import Carrito
from app.models.detalle_carrito import DetalleCarrito
from app.models.producto import Producto
from app.repositories.carrito import CarritoRepositorio
from app.repositories.descuento import DescuentoRepositorio
from app.repositories.producto import ProductoRepositorio
from app.schemas.carrito import ItemCarritoCrear
from app.services.descuento import calcular_precio_final

CERO = Decimal("0.00")


# --- helpers -----------------------------------------------------------------

def obtener_o_crear_carrito(sesion: Session, id_usuario: int) -> Carrito:
    """El carrito abierto del usuario; si no tiene, se lo crea con fecha de hoy."""
    repo = CarritoRepositorio(sesion)
    carrito = repo.buscar_activo_de_usuario(id_usuario)
    if carrito is not None:
        return carrito

    carrito = repo.crear(id_usuario, date.today())
    sesion.commit()
    sesion.refresh(carrito)
    return carrito


def _obtener_carrito_del_usuario(
    sesion: Session, id_usuario: int, crear: bool = False
) -> Carrito:
    repo = CarritoRepositorio(sesion)
    carrito = repo.buscar_activo_de_usuario(id_usuario)
    if carrito is None:
        if not crear:
            raise NoEncontrado("El usuario no tiene un carrito abierto")
        carrito = repo.crear(id_usuario, date.today())
        sesion.commit()
        sesion.refresh(carrito)
    return carrito


def _obtener_detalle_propio(
    sesion: Session, carrito: Carrito, id_detalle: int, incluir_inhabilitados: bool = False
) -> DetalleCarrito:
    """Valida que la linea exista, sea de este carrito y no este anulada."""
    detalle = CarritoRepositorio(sesion).buscar_detalle(id_detalle)
    if detalle is None or detalle.id_carrito_fk != carrito.id_carrito:
        raise NoEncontrado(f"No existe la linea {id_detalle} en su carrito")
    if detalle.inhabilitado and not incluir_inhabilitados:
        raise NoEncontrado(f"La linea {id_detalle} ya fue retirada del carrito")
    return detalle


def _obtener_producto_comprable(sesion: Session, id_producto: int) -> Producto:
    producto = ProductoRepositorio(sesion).buscar_por_id(id_producto)
    if producto is None:
        raise NoEncontrado(f"No existe el producto con id {id_producto}")
    if producto.inhabilitado:
        raise ReglaNegocio(
            f"El producto '{producto.nombre}' esta inhabilitado y no se puede comprar"
        )
    return producto


def _validar_stock(repo: CarritoRepositorio, id_producto: int, cantidad: int) -> None:
    """Solo valida si el producto tiene inventario registrado."""
    disponible = repo.stock_disponible(id_producto)
    if disponible is None:
        return
    if cantidad > disponible:
        raise ReglaNegocio(
            f"Stock insuficiente: hay {disponible} unidades y se piden {cantidad}"
        )


def _precio_vigente(
    sesion: Session, producto: Producto
) -> tuple[Decimal, Decimal, Decimal]:
    """(precio_lista, descuento_unitario, precio_unitario) con el descuento de hoy."""
    descuento = DescuentoRepositorio(sesion).buscar_activo_por_producto(
        producto.id_producto
    )
    return calcular_precio_final(producto.precio, descuento)


def _armar_respuesta(sesion: Session, carrito: Carrito) -> dict:
    """Calcula precios, subtotales y totales de todo el carrito."""
    repo = CarritoRepositorio(sesion)
    items: list[dict] = []
    total_unidades = 0
    subtotal_lista = CERO
    descuento_total = CERO
    total = CERO

    for detalle in repo.listar_detalles(carrito.id_carrito):
        producto = ProductoRepositorio(sesion).buscar_por_id(detalle.id_producto_fk)
        if producto is None:  # dato huerfano en la BD: se salta, no se rompe
            continue

        lista, rebaja, final = _precio_vigente(sesion, producto)
        cantidad = detalle.cantidad or 0

        items.append(
            {
                "id_detalle_carrito": detalle.id_detalle_carrito,
                "id_producto": producto.id_producto,
                "nombre": producto.nombre,
                "talla": producto.talla,
                "color": producto.color,
                "imagen": producto.imagen,
                "cantidad": cantidad,
                "precio_lista": lista,
                "descuento_unitario": rebaja,
                "precio_unitario": final,
                "subtotal_lista": lista * cantidad,
                "descuento_total": rebaja * cantidad,
                "subtotal": final * cantidad,
                "stock_disponible": repo.stock_disponible(producto.id_producto),
            }
        )
        total_unidades += cantidad
        subtotal_lista += lista * cantidad
        descuento_total += rebaja * cantidad
        total += final * cantidad

    return {
        "id_carrito": carrito.id_carrito,
        "fecha_creacion": carrito.fecha_creacion,
        "items": items,
        "total_unidades": total_unidades,
        "subtotal_lista": subtotal_lista,
        "descuento_total": descuento_total,
        "total": total,
    }


# --- operaciones -------------------------------------------------------------

def ver_carrito(sesion: Session, id_usuario: int) -> dict:
    """Estado actual del carrito. Si el usuario no tiene, devuelve uno vacio."""
    carrito = obtener_o_crear_carrito(sesion, id_usuario)
    return _armar_respuesta(sesion, carrito)


def agregar_item(sesion: Session, id_usuario: int, datos: ItemCarritoCrear) -> dict:
    """Agrega (o acumula) un producto en el carrito del usuario."""
    producto = _obtener_producto_comprable(sesion, datos.id_producto)
    carrito = _obtener_carrito_del_usuario(sesion, id_usuario, crear=True)
    repo = CarritoRepositorio(sesion)

    existente = repo.buscar_detalle_de_producto(
        carrito.id_carrito, producto.id_producto
    )
    cantidad_nueva = datos.cantidad
    if existente is not None and not existente.inhabilitado:
        cantidad_nueva = (existente.cantidad or 0) + datos.cantidad

    _validar_stock(repo, producto.id_producto, cantidad_nueva)

    if existente is not None:
        # Reutiliza la fila: si estaba retirada, se reactiva (no se duplica).
        repo.actualizar_detalle(existente, cantidad_nueva)
    else:
        repo.crear_detalle(carrito.id_carrito, producto.id_producto, datos.cantidad)

    sesion.commit()
    sesion.refresh(carrito)
    return _armar_respuesta(sesion, carrito)


def actualizar_item(
    sesion: Session, id_usuario: int, id_detalle: int, cantidad: int
) -> dict:
    """Fija la cantidad de una linea (PATCH). La cantidad ya viene validada (>0)."""
    carrito = _obtener_carrito_del_usuario(sesion, id_usuario)
    detalle = _obtener_detalle_propio(sesion, carrito, id_detalle)

    _validar_stock(CarritoRepositorio(sesion), detalle.id_producto_fk, cantidad)

    CarritoRepositorio(sesion).actualizar_detalle(detalle, cantidad)
    sesion.commit()
    sesion.refresh(carrito)
    return _armar_respuesta(sesion, carrito)


def quitar_item(sesion: Session, id_usuario: int, id_detalle: int) -> dict:
    """Retira la linea del carrito SIN borrarla (inhabilitado=True)."""
    carrito = _obtener_carrito_del_usuario(sesion, id_usuario)
    detalle = _obtener_detalle_propio(sesion, carrito, id_detalle)

    CarritoRepositorio(sesion).inhabilitar_detalle(detalle)
    sesion.commit()
    sesion.refresh(carrito)
    return _armar_respuesta(sesion, carrito)


def vaciar_carrito(sesion: Session, id_usuario: int) -> dict:
    """Vacia el carrito marcando todas sus lineas como inhabilitadas.

    Es idempotente: si el usuario no tiene carrito, responde un carrito vacio
    en vez de 404 (asi el boton "vaciar" nunca falla).
    """
    carrito = _obtener_carrito_del_usuario(sesion, id_usuario, crear=True)
    CarritoRepositorio(sesion).inhabilitar_todos(carrito.id_carrito)
    sesion.commit()
    sesion.refresh(carrito)
    return _armar_respuesta(sesion, carrito)


def cerrar_carrito(sesion: Session, carrito: Carrito) -> Carrito:
    """Cierra el carrito (lo usara el modulo de pedidos al finalizar la compra)."""
    return CarritoRepositorio(sesion).inhabilitar(carrito)


def lineas_activas(sesion: Session, carrito: Carrito) -> list[DetalleCarrito]:
    """Lineas vigentes del carrito, para que las convierta el modulo de pedidos."""
    return CarritoRepositorio(sesion).listar_detalles(carrito.id_carrito)