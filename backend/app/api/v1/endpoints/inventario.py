from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query, status

from app.core.dependencies import (
    ROL_ADMINISTRADOR,
    ROL_BODEGUERO,
    SesionBD,
    UsuarioActual,
    requiere_rol,
)
from app.core.pagination import PaginaRespuesta, ParametrosPaginacion
from app.schemas.inventario import (
    AjusteStock,
    AlertaStockRespuesta,
    EntradaStock,
    InventarioActualizar,
    InventarioCrear,
    InventarioRespuesta,
    MovimientoRespuesta,
    SalidaStock,
    StockPorProducto,
)
from app.services import inventario as servicio

router = APIRouter()

# El inventario lo mueve el bodeguero o el administrador
GestionaInventario = Depends(requiere_rol(ROL_ADMINISTRADOR, ROL_BODEGUERO))


@router.get("", response_model=PaginaRespuesta[InventarioRespuesta])
def listar(sesion: SesionBD, paginacion: ParametrosPaginacion = Depends()):
    """Filas de inventario tal como estan en la BD."""
    items, total = servicio.listar_inventario(
        sesion, saltar=paginacion.saltar, limite=paginacion.limite
    )
    return PaginaRespuesta[InventarioRespuesta](
        total=total,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        items=[InventarioRespuesta.model_validate(i) for i in items],
    )


@router.get("/stock", response_model=PaginaRespuesta[StockPorProducto])
def stock_por_producto(sesion: SesionBD, paginacion: ParametrosPaginacion = Depends()):
    """Stock total por producto, sumando todas sus filas de inventario."""
    filas, total = servicio.stock_por_producto(
        sesion, saltar=paginacion.saltar, limite=paginacion.limite
    )
    items = [
        StockPorProducto(
            id_producto=f["id_producto"],
            nombre=f["nombre"],
            categoria=f["categoria"],
            talla=f["talla"],
            color=f["color"],
            stock_total=int(f["stock_total"] or 0),
            stock_minimo=int(f["stock_minimo"] or 0),
            bajo_minimo=int(f["stock_total"] or 0) <= int(f["stock_minimo"] or 0),
            filas_inventario=int(f["filas"] or 0),
            inhabilitado=False,
        )
        for f in filas
    ]
    return PaginaRespuesta[StockPorProducto](
        total=total, saltar=paginacion.saltar, limite=paginacion.limite, items=items
    )


@router.get("/movimientos", response_model=PaginaRespuesta[MovimientoRespuesta])
def movimientos(
    sesion: SesionBD,
    paginacion: ParametrosPaginacion = Depends(),
    id_inventario: Optional[int] = Query(None),
    tipo_movimiento: Optional[Literal["ENTRADA", "SALIDA", "AJUSTE"]] = Query(None),
):
    """Historial de movimientos, del mas reciente al mas antiguo."""
    items, total = servicio.listar_movimientos(
        sesion,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        id_inventario=id_inventario,
        tipo_movimiento=tipo_movimiento,
    )
    return PaginaRespuesta[MovimientoRespuesta](
        total=total,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        items=[MovimientoRespuesta.model_validate(m) for m in items],
    )


@router.get("/alertas", response_model=PaginaRespuesta[AlertaStockRespuesta])
def alertas(sesion: SesionBD, paginacion: ParametrosPaginacion = Depends()):
    """Alertas de stock generadas automaticamente al bajar del minimo."""
    items, total = servicio.listar_alertas(
        sesion, saltar=paginacion.saltar, limite=paginacion.limite
    )
    return PaginaRespuesta[AlertaStockRespuesta](
        total=total,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        items=[AlertaStockRespuesta.model_validate(a) for a in items],
    )


@router.get("/{id_inventario}", response_model=InventarioRespuesta)
def detalle(id_inventario: int, sesion: SesionBD):
    return servicio.obtener_fila(sesion, id_inventario)


@router.post(
    "",
    response_model=InventarioRespuesta,
    status_code=status.HTTP_201_CREATED,
    dependencies=[GestionaInventario],
)
def crear(datos: InventarioCrear, sesion: SesionBD):
    """Crea la fila de inventario de un producto. Requiere Admin o Bodeguero."""
    return servicio.crear_inventario(sesion, datos)


@router.patch(
    "/{id_inventario}",
    response_model=InventarioRespuesta,
    dependencies=[GestionaInventario],
)
def actualizar_minimo(
    id_inventario: int, datos: InventarioActualizar, sesion: SesionBD
):
    """Cambia solo el stock minimo (para el resto de campos, use ajuste)."""
    return servicio.actualizar_stock_minimo(
        sesion, id_inventario, datos.stock_minimo or 0
    )


@router.post(
    "/{id_inventario}/entrada",
    response_model=MovimientoRespuesta,
    status_code=status.HTTP_201_CREATED,
    dependencies=[GestionaInventario],
)
def entrada(
    id_inventario: int,
    datos: EntradaStock,
    sesion: SesionBD,
    usuario: UsuarioActual,
):
    """Registra una ENTRADA de stock y devuelve el movimiento generado."""
    _, movimiento = servicio.registrar_entrada(
        sesion, id_inventario, datos, usuario_responsable=usuario.nombre
    )
    return movimiento


@router.post(
    "/{id_inventario}/salida",
    response_model=MovimientoRespuesta,
    status_code=status.HTTP_201_CREATED,
    dependencies=[GestionaInventario],
)
def salida(
    id_inventario: int,
    datos: SalidaStock,
    sesion: SesionBD,
    usuario: UsuarioActual,
):
    """Registra una SALIDA. Falla con 400 si el stock no alcanza."""
    _, movimiento = servicio.registrar_salida(
        sesion, id_inventario, datos, usuario_responsable=usuario.nombre
    )
    return movimiento


@router.post(
    "/{id_inventario}/ajuste",
    response_model=MovimientoRespuesta,
    status_code=status.HTTP_201_CREATED,
    dependencies=[GestionaInventario],
)
def ajuste(
    id_inventario: int,
    datos: AjusteStock,
    sesion: SesionBD,
    usuario: UsuarioActual,
):
    """Conteo fisico: fija el stock en un valor absoluto."""
    _, movimiento = servicio.registrar_ajuste(
        sesion, id_inventario, datos, usuario_responsable=usuario.nombre
    )
    return movimiento