"""Servicio de inventario. No importa fastapi: logica pura + SQLAlchemy.

Reglas de negocio implementadas aqui:
  - Toda variacion de stock genera un MovimientoInventario (trazabilidad).
  - Una salida no puede dejar el stock en negativo.
  - Si el stock queda en o por debajo del minimo, se genera una AlertaStock
    (una por producto y dia, para no llenar la tabla).
  - La transaccion (commit) se cierra en el servicio, no en el repositorio.
"""

from sqlalchemy.orm import Session

from app.core.exceptions import Conflicto, NoEncontrado, ReglaNegocio
from app.models.alerta_stock import AlertaStock
from app.models.inventario import Inventario
from app.models.movimiento_inventario import MovimientoInventario
from app.repositories.inventario import InventarioRepositorio
from app.repositories.producto import ProductoRepositorio
from app.schemas.inventario import (
    AjusteStock,
    EntradaStock,
    InventarioCrear,
    SalidaStock,
)


def _obtener_fila_o_fallar(repo: InventarioRepositorio, id_inventario: int) -> Inventario:
    fila = repo.buscar_por_id(id_inventario)
    if fila is None:
        raise NoEncontrado(f"No existe la fila de inventario {id_inventario}")
    return fila


def _verificar_alerta(
    repo: InventarioRepositorio, id_producto: int | None, stock_nuevo: int, minimo: int
) -> AlertaStock | None:
    """Genera alerta si el stock cayo al minimo o por debajo (una por dia)."""
    if id_producto is None or stock_nuevo > minimo:
        return None
    if repo.alerta_vigente(id_producto) is not None:
        return None
    return repo.crear_alerta(id_producto, stock_nuevo)


def listar_inventario(sesion: Session, saltar: int = 0, limite: int = 20):
    repo = InventarioRepositorio(sesion)
    return repo.listar(saltar=saltar, limite=limite), repo.contar()


def stock_por_producto(sesion: Session, saltar: int = 0, limite: int = 20):
    repo = InventarioRepositorio(sesion)
    return (
        repo.stock_por_producto(saltar=saltar, limite=limite),
        repo.contar_productos_con_inventario(),
    )


def obtener_fila(sesion: Session, id_inventario: int) -> Inventario:
    return _obtener_fila_o_fallar(InventarioRepositorio(sesion), id_inventario)


def crear_inventario(sesion: Session, datos: InventarioCrear) -> Inventario:
    repo = InventarioRepositorio(sesion)
    productos = ProductoRepositorio(sesion)

    if productos.buscar_por_id(datos.id_producto_fk) is None:
        raise NoEncontrado(f"No existe el producto {datos.id_producto_fk}")
    if repo.listar_por_producto(datos.id_producto_fk):
        raise Conflicto(
            f"El producto {datos.id_producto_fk} ya tiene una fila de inventario"
        )

    fila = repo.crear(datos)
    sesion.commit()
    sesion.refresh(fila)
    return fila


def actualizar_stock_minimo(
    sesion: Session, id_inventario: int, nuevo_minimo: int
) -> Inventario:
    repo = InventarioRepositorio(sesion)
    fila = _obtener_fila_o_fallar(repo, id_inventario)
    fila.stock_minimo = nuevo_minimo
    sesion.commit()
    sesion.refresh(fila)
    return fila


def registrar_entrada(
    sesion: Session,
    id_inventario: int,
    datos: EntradaStock,
    usuario_responsable: str | None = None,
) -> tuple[Inventario, MovimientoInventario]:
    """Suma stock y deja el movimiento en el historial."""
    repo = InventarioRepositorio(sesion)
    fila = _obtener_fila_o_fallar(repo, id_inventario)

    anterior = fila.cantidad_actual or 0
    fila.cantidad_actual = anterior + datos.cantidad

    producto = ProductoRepositorio(sesion).buscar_por_id(fila.id_producto_fk)
    movimiento = repo.registrar_movimiento(
        id_inventario=fila.id_inventario,
        nombre_producto=producto.nombre if producto else None,
        tipo="ENTRADA",
        cantidad=datos.cantidad,
        motivo=datos.motivo,
        usuario_responsable=usuario_responsable,
    )

    sesion.commit()
    sesion.refresh(fila)
    sesion.refresh(movimiento)
    return fila, movimiento


def registrar_salida(
    sesion: Session,
    id_inventario: int,
    datos: SalidaStock,
    usuario_responsable: str | None = None,
) -> tuple[Inventario, MovimientoInventario]:
    """Resta stock; falla si no alcanza (nunca queda negativo)."""
    repo = InventarioRepositorio(sesion)
    fila = _obtener_fila_o_fallar(repo, id_inventario)

    anterior = fila.cantidad_actual or 0
    if datos.cantidad > anterior:
        raise ReglaNegocio(
            f"Stock insuficiente: hay {anterior} unidades y se piden {datos.cantidad}"
        )

    fila.cantidad_actual = anterior - datos.cantidad

    producto = ProductoRepositorio(sesion).buscar_por_id(fila.id_producto_fk)
    movimiento = repo.registrar_movimiento(
        id_inventario=fila.id_inventario,
        nombre_producto=producto.nombre if producto else None,
        tipo="SALIDA",
        cantidad=datos.cantidad,
        motivo=datos.motivo,
        usuario_responsable=usuario_responsable,
    )

    _verificar_alerta(
        repo, fila.id_producto_fk, fila.cantidad_actual, fila.stock_minimo or 0
    )

    sesion.commit()
    sesion.refresh(fila)
    sesion.refresh(movimiento)
    return fila, movimiento


def registrar_ajuste(
    sesion: Session,
    id_inventario: int,
    datos: AjusteStock,
    usuario_responsable: str | None = None,
) -> tuple[Inventario, MovimientoInventario]:
    """Conteo fisico: fija el stock en un valor absoluto.

    El movimiento guarda la DIFERENCIA (nuevo - anterior), que es lo que permite
    reconstruir el historial; si se guardara el valor absoluto no se sabria
    cuanto cambio.
    """
    repo = InventarioRepositorio(sesion)
    fila = _obtener_fila_o_fallar(repo, id_inventario)

    anterior = fila.cantidad_actual or 0
    diferencia = datos.cantidad_actual - anterior
    if diferencia == 0:
        raise ReglaNegocio(f"El stock ya es {anterior}; no hay nada que ajustar")

    fila.cantidad_actual = datos.cantidad_actual

    producto = ProductoRepositorio(sesion).buscar_por_id(fila.id_producto_fk)
    movimiento = repo.registrar_movimiento(
        id_inventario=fila.id_inventario,
        nombre_producto=producto.nombre if producto else None,
        tipo="AJUSTE",
        cantidad=diferencia,
        motivo=datos.motivo or f"Ajuste de {anterior} a {datos.cantidad_actual}",
        usuario_responsable=usuario_responsable,
    )

    _verificar_alerta(
        repo, fila.id_producto_fk, fila.cantidad_actual, fila.stock_minimo or 0
    )

    sesion.commit()
    sesion.refresh(fila)
    sesion.refresh(movimiento)
    return fila, movimiento


def listar_movimientos(
    sesion: Session,
    saltar: int = 0,
    limite: int = 20,
    id_inventario: int | None = None,
    tipo_movimiento: str | None = None,
):
    repo = InventarioRepositorio(sesion)
    items = repo.listar_movimientos(
        saltar=saltar,
        limite=limite,
        id_inventario=id_inventario,
        tipo_movimiento=tipo_movimiento,
    )
    total = repo.contar_movimientos(
        id_inventario=id_inventario, tipo_movimiento=tipo_movimiento
    )
    return items, total


def listar_alertas(sesion: Session, saltar: int = 0, limite: int = 20):
    repo = InventarioRepositorio(sesion)
    return repo.listar_alertas(saltar=saltar, limite=limite), repo.contar_alertas()
