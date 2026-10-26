from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.alerta_stock import AlertaStock
from app.models.inventario import Inventario
from app.models.movimiento_inventario import MovimientoInventario
from app.models.producto import Producto
from app.schemas.inventario import InventarioCrear


class InventarioRepositorio:
    def _init_(self, sesion: Session) -> None:
        self.sesion = sesion

    # --- inventario -------------------------------------------------------

    def buscar_por_id(self, id_inventario: int) -> Inventario | None:
        return self.sesion.get(Inventario, id_inventario)

    def listar_por_producto(self, id_producto: int) -> list[Inventario]:
        consulta = (
            select(Inventario)
            .where(Inventario.id_producto_fk == id_producto)
            .order_by(Inventario.id_inventario)
        )
        return list(self.sesion.scalars(consulta))

    def listar(self, saltar: int = 0, limite: int = 20) -> list[Inventario]:
        consulta = (
            select(Inventario)
            .order_by(Inventario.id_inventario)
            .offset(saltar)
            .limit(limite)
        )
        return list(self.sesion.scalars(consulta))

    def contar(self) -> int:
        return self.sesion.scalar(select(func.count()).select_from(Inventario)) or 0

    def stock_por_producto(self, saltar: int = 0, limite: int = 20) -> list[dict]:
        """Agrega el stock de todas las filas de inventario de cada producto."""
        consulta = (
            select(
                Producto.id_producto,
                Producto.nombre,
                Producto.categoria,
                Producto.talla,
                Producto.color,
                func.coalesce(func.sum(Inventario.cantidad_actual), 0).label("stock_total"),
                func.coalesce(func.max(Inventario.stock_minimo), 0).label("stock_minimo"),
                func.count(Inventario.id_inventario).label("filas"),
            )
            .join(Inventario, Inventario.id_producto_fk == Producto.id_producto)
            .group_by(
                Producto.id_producto,
                Producto.nombre,
                Producto.categoria,
                Producto.talla,
                Producto.color,
            )
            .order_by(Producto.id_producto)
            .offset(saltar)
            .limit(limite)
        )
        return [dict(fila._mapping) for fila in self.sesion.execute(consulta)]

    def contar_productos_con_inventario(self) -> int:
        consulta = select(func.count(func.distinct(Inventario.id_producto_fk)))
        return self.sesion.scalar(consulta) or 0

    def crear(self, datos: InventarioCrear) -> Inventario:
        inventario = Inventario(**datos.model_dump())
        self.sesion.add(inventario)
        self.sesion.flush()
        return inventario

    # --- movimientos ------------------------------------------------------

    def registrar_movimiento(
        self,
        id_inventario: int,
        nombre_producto: str | None,
        tipo: str,
        cantidad: int,
        motivo: str | None,
        usuario_responsable: str | None,
    ) -> MovimientoInventario:
        movimiento = MovimientoInventario(
            id_inventario=id_inventario,
            nombre_producto=nombre_producto,
            tipo_movimiento=tipo,
            cantidad=cantidad,
            motivo=motivo,
            usuario_responsable=usuario_responsable,
            fecha_hora=datetime.now(),
        )
        self.sesion.add(movimiento)
        self.sesion.flush()
        return movimiento

    def listar_movimientos(
        self,
        saltar: int = 0,
        limite: int = 20,
        id_inventario: int | None = None,
        tipo_movimiento: str | None = None,
    ) -> list[MovimientoInventario]:
        consulta = select(MovimientoInventario)
        if id_inventario is not None:
            consulta = consulta.where(MovimientoInventario.id_inventario == id_inventario)
        if tipo_movimiento is not None:
            consulta = consulta.where(
                MovimientoInventario.tipo_movimiento == tipo_movimiento
            )
        consulta = (
            consulta.order_by(MovimientoInventario.id.desc())
            .offset(saltar)
            .limit(limite)
        )
        return list(self.sesion.scalars(consulta))

    def contar_movimientos(
        self, id_inventario: int | None = None, tipo_movimiento: str | None = None
    ) -> int:
        consulta = select(func.count()).select_from(MovimientoInventario)
        if id_inventario is not None:
            consulta = consulta.where(MovimientoInventario.id_inventario == id_inventario)
        if tipo_movimiento is not None:
            consulta = consulta.where(
                MovimientoInventario.tipo_movimiento == tipo_movimiento
            )
        return self.sesion.scalar(consulta) or 0

    # --- alertas ----------------------------------------------------------

    def alerta_vigente(self, id_producto: int) -> AlertaStock | None:
        consulta = (
            select(AlertaStock)
            .where(AlertaStock.id_producto_fk == id_producto)
            .where(AlertaStock.fecha_alerta == date.today())
            .order_by(AlertaStock.id_alerta.desc())
        )
        return self.sesion.scalars(consulta).first()

    def crear_alerta(self, id_producto: int, nivel_stock: int) -> AlertaStock:
        alerta = AlertaStock(
            id_producto_fk=id_producto,
            nivel_stock=nivel_stock,
            fecha_alerta=date.today(),
        )
        self.sesion.add(alerta)
        self.sesion.flush()
        return alerta

    def listar_alertas(self, saltar: int = 0, limite: int = 20) -> list[AlertaStock]:
        consulta = (
            select(AlertaStock)
            .order_by(AlertaStock.id_alerta.desc())
            .offset(saltar)
            .limit(limite)
        )
        return list(self.sesion.scalars(consulta))

    def contar_alertas(self) -> int:
        return self.sesion.scalar(select(func.count()).select_from(AlertaStock)) or 0