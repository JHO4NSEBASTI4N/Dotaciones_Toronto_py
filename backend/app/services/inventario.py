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