from sqlalchemy.orm import Session

from app.core.exceptions import Conflicto, NoEncontrado, ReglaNegocio
from app.models.producto import Producto
from app.repositories.producto import ProductoRepositorio
from app.schemas.producto import ProductoActualizar, ProductoCrear


def _obtener_o_fallar(
    repo: ProductoRepositorio, id_producto: int, incluir_inhabilitados: bool = True
) -> Producto:
    producto = repo.buscar_por_id(id_producto)
    if producto is None:
        raise NoEncontrado(f"No existe el producto con id {id_producto}")
    if producto.inhabilitado and not incluir_inhabilitados:
        raise NoEncontrado(f"No existe el producto con id {id_producto}")
    return producto


def listar_productos(
    sesion: Session,
    saltar: int = 0,
    limite: int = 20,
    nombre: str | None = None,
    categoria: str | None = None,
    talla: str | None = None,
    color: str | None = None,
    incluir_inhabilitados: bool = False,
) -> tuple[list[Producto], int]:
    repo = ProductoRepositorio(sesion)
    items = repo.listar(
        saltar=saltar,
        limite=limite,
        nombre=nombre,
        categoria=categoria,
        talla=talla,
        color=color,
        incluir_inhabilitados=incluir_inhabilitados,
    )
    total = repo.contar(
        nombre=nombre,
        categoria=categoria,
        talla=talla,
        color=color,
        incluir_inhabilitados=incluir_inhabilitados,
    )
    return items, total


def obtener_producto(sesion: Session, id_producto: int) -> Producto:
    return _obtener_o_fallar(ProductoRepositorio(sesion), id_producto)


def crear_producto(sesion: Session, datos: ProductoCrear) -> Producto:
    repo = ProductoRepositorio(sesion)
    if repo.buscar_por_nombre(datos.nombre):
        raise Conflicto(f"Ya existe un producto llamado '{datos.nombre}'")

    producto = repo.crear(datos)
    sesion.commit()
    sesion.refresh(producto)
    return producto


def actualizar_producto(
    sesion: Session, id_producto: int, datos: ProductoActualizar
) -> Producto:
    repo = ProductoRepositorio(sesion)
    producto = _obtener_o_fallar(repo, id_producto)

    cambios = datos.model_dump(exclude_unset=True)
    if not cambios:
        raise ReglaNegocio("No se envio ningun campo para actualizar")

    nuevo_nombre = cambios.get("nombre")
    if nuevo_nombre and nuevo_nombre != producto.nombre:
        existente = repo.buscar_por_nombre(nuevo_nombre)
        if existente is not None:
            raise Conflicto(f"Ya existe un producto llamado '{nuevo_nombre}'")

    producto = repo.actualizar(producto, datos)
    sesion.commit()
    sesion.refresh(producto)
    return producto


def inhabilitar_producto(sesion: Session, id_producto: int) -> Producto:
    repo = ProductoRepositorio(sesion)
    producto = _obtener_o_fallar(repo, id_producto)
    if producto.inhabilitado:
        raise Conflicto("El producto ya esta inhabilitado")

    producto = repo.inhabilitar(producto)
    sesion.commit()
    sesion.refresh(producto)
    return producto


def habilitar_producto(sesion: Session, id_producto: int) -> Producto:
    repo = ProductoRepositorio(sesion)
    producto = _obtener_o_fallar(repo, id_producto)
    if not producto.inhabilitado:
        raise Conflicto("El producto ya esta habilitado")

    producto = repo.habilitar(producto)
    sesion.commit()
    sesion.refresh(producto)
    return producto