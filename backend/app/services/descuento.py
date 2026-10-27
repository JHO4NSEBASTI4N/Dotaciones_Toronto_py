"""Servicio del catalogo de descuentos. No importa fastapi: logica pura + SQLAlchemy.

Reglas de negocio implementadas aqui:

  - Un producto tiene como maximo UN descuento activo. Al crear o activar uno
    nuevo, los anteriores se apagan (no se borran: quedan como historial).
  - No se descuenta un producto inexistente ni uno inhabilitado.
  - PORCENTAJE: el valor va de 0 a 100.
  - FIJO: el valor no puede superar el precio del producto (lo dejaria en cero).
  - `calcular_precio_final` es la funcion que reutilizara el modulo de pedidos
    para congelar el precio en `detalle_pedido`.
"""

from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import Conflicto, NoEncontrado, ReglaNegocio
from app.models.descuento import Descuento
from app.models.producto import Producto
from app.repositories.descuento import DescuentoRepositorio
from app.repositories.producto import ProductoRepositorio
from app.schemas.descuento import DescuentoActualizar, DescuentoCrear

CENTAVO = Decimal("0.01")

# Igual que en el resto del proyecto: no se elimina, se inactiva.
ACTIVO = True


def _centavos(valor: Decimal) -> Decimal:
    """Redondeo comercial a 2 decimales (0.005 sube, que es lo que espera Hacienda)."""
    return Decimal(valor).quantize(CENTAVO, rounding=ROUND_HALF_UP)


def _obtener_o_fallar(repo: DescuentoRepositorio, id_descuento: int) -> Descuento:
    descuento = repo.buscar_por_id(id_descuento)
    if descuento is None:
        raise NoEncontrado(f"No existe el descuento con id {id_descuento}")
    return descuento


def _obtener_producto_valido(sesion: Session, id_producto: int) -> Producto:
    """El producto debe existir y estar habilitado para poder descontarlo."""
    producto = ProductoRepositorio(sesion).buscar_por_id(id_producto)
    if producto is None:
        raise NoEncontrado(f"No existe el producto con id {id_producto}")
    if producto.inhabilitado:
        raise ReglaNegocio(
            f"El producto '{producto.nombre}' esta inhabilitado: no admite descuentos"
        )
    return producto


def _validar_valor(
    tipo_descuento: str, valor: Decimal, precio_producto: Decimal
) -> None:
    """Comprueba el rango del valor contra el tipo ya combinado (crear y PATCH)."""
    if tipo_descuento == "PORCENTAJE":
        if valor <= 0 or valor > 100:
            raise ReglaNegocio("Un descuento PORCENTAJE debe estar entre 0 y 100")
        return

    if tipo_descuento == "FIJO":
        if valor <= 0:
            raise ReglaNegocio("Un descuento FIJO debe ser mayor a 0")
        if valor > precio_producto:
            raise ReglaNegocio(
                f"El descuento FIJO ({valor}) no puede superar el precio del "
                f"producto ({_centavos(precio_producto)})"
            )
        return

    raise ReglaNegocio(
        f"Tipo de descuento invalido: '{tipo_descuento}'. Use PORCENTAJE o FIJO"
    )


def calcular_precio_final(
    precio_lista: Decimal, descuento: Descuento | None
) -> tuple[Decimal, Decimal, Decimal]:
    """Devuelve (precio_lista, descuento_unitario, precio_unitario_final).

    Es la foto que se guarda en `detalle_pedido` / `detalle_venta`:
    `precio_unitario` sigue siendo el precio FINAL pagado, y el precio de
    lista y el descuento quedan aparte para poder mostrarlos y facturarlos.

    Sin descuento devuelve el precio intacto y descuento 0.
    """
    lista = _centavos(precio_lista)
    if descuento is None or not descuento.activo:
        return lista, Decimal("0.00"), lista

    valor = Decimal(descuento.valor_descuento or 0)
    if descuento.tipo_descuento == "PORCENTAJE":
        rebaja = _centavos(lista * valor / Decimal("100"))
    else:
        rebaja = _centavos(valor)

    # Nunca se descuenta mas de lo que vale: el precio final no baja de cero.
    rebaja = min(rebaja, lista)
    final = _centavos(lista - rebaja)
    return lista, rebaja, final


def listar_descuentos(
    sesion: Session,
    saltar: int = 0,
    limite: int = 20,
    id_producto: int | None = None,
    tipo_descuento: str | None = None,
    activo: bool | None = None,
) -> tuple[list[Descuento], int]:
    repo = DescuentoRepositorio(sesion)
    items = repo.listar(
        saltar=saltar,
        limite=limite,
        id_producto=id_producto,
        tipo_descuento=tipo_descuento,
        activo=activo,
    )
    total = repo.contar(
        id_producto=id_producto, tipo_descuento=tipo_descuento, activo=activo
    )
    return items, total


def obtener_descuento(sesion: Session, id_descuento: int) -> Descuento:
    return _obtener_o_fallar(DescuentoRepositorio(sesion), id_descuento)


def obtener_vigente_de_producto(
    sesion: Session, id_producto: int, precio_lista: Decimal | None = None
) -> dict:
    """El descuento activo de un producto, ya con el precio final calculado.

    Lo usara el carrito/pedido: con el id del producto en la mano devuelve
    cuanto se cobra.
    """
    producto = _obtener_producto_valido(sesion, id_producto)
    descuento = DescuentoRepositorio(sesion).buscar_activo_por_producto(id_producto)
    if descuento is None:
        raise NoEncontrado(
            f"El producto con id {id_producto} no tiene un descuento activo"
        )

    lista, rebaja, final = calcular_precio_final(
        producto.precio if precio_lista is None else precio_lista, descuento
    )
    return {
        "descuento": descuento,
        "precio_lista": lista,
        "descuento_unitario": rebaja,
        "precio_unitario": final,
    }


def crear_descuento(sesion: Session, datos: DescuentoCrear) -> Descuento:
    repo = DescuentoRepositorio(sesion)
    producto = _obtener_producto_valido(sesion, datos.id_producto_fk)
    _validar_valor(datos.tipo_descuento, datos.valor_descuento, producto.precio)

    # Un solo activo por producto: los anteriores pasan a inactivos (historial).
    repo.desactivar_activos_de_producto(producto.id_producto)

    descuento = repo.crear(datos)
    sesion.commit()
    sesion.refresh(descuento)
    return descuento


def actualizar_descuento(
    sesion: Session, id_descuento: int, datos: DescuentoActualizar
) -> Descuento:
    repo = DescuentoRepositorio(sesion)
    descuento = _obtener_o_fallar(repo, id_descuento)

    cambios = datos.model_dump(exclude_unset=True)
    if not cambios:
        raise ReglaNegocio("No se envio ningun campo para actualizar")

    # Se valida con los valores ya combinados (un PATCH puede traer solo uno).
    id_producto = cambios.get("id_producto_fk", descuento.id_producto_fk)
    tipo = cambios.get("tipo_descuento", descuento.tipo_descuento)
    valor = cambios.get("valor_descuento", descuento.valor_descuento)

    producto = _obtener_producto_valido(sesion, id_producto)
    _validar_valor(tipo, valor, producto.precio)

    if id_producto != descuento.id_producto_fk and descuento.activo:
        # Se mueve un descuento vigente a otro producto: manda el nuevo destino.
        repo.desactivar_activos_de_producto(id_producto)

    descuento = repo.actualizar(descuento, datos)
    sesion.commit()
    sesion.refresh(descuento)
    return descuento


def desactivar_descuento(sesion: Session, id_descuento: int) -> Descuento:
    """Baja logica. NO existe DELETE: la fila se conserva para el historial."""
    repo = DescuentoRepositorio(sesion)
    descuento = _obtener_o_fallar(repo, id_descuento)
    if not descuento.activo:
        raise Conflicto("El descuento ya esta inactivo")

    descuento = repo.desactivar(descuento)
    sesion.commit()
    sesion.refresh(descuento)
    return descuento


def activar_descuento(sesion: Session, id_descuento: int) -> Descuento:
    repo = DescuentoRepositorio(sesion)
    descuento = _obtener_o_fallar(repo, id_descuento)
    if descuento.activo:
        raise Conflicto("El descuento ya esta activo")

    producto = _obtener_producto_valido(sesion, descuento.id_producto_fk)
    _validar_valor(
        descuento.tipo_descuento, descuento.valor_descuento, producto.precio
    )

    # Regla de un solo activo por producto: se apaga el que estuviera vigente.
    repo.desactivar_activos_de_producto(descuento.id_producto_fk)

    descuento = repo.activar(descuento)
    sesion.commit()
    sesion.refresh(descuento)
    return descuento
