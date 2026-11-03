from datetime import datetime
from decimal import Decimal
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.models.detalle_pedido import DetallePedido
from app.models.pedido import Pedido

class PedidoRepositorio:

    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def buscar_por_id(self, id_pedido: int) -> Pedido | None:
        return self.sesion.get(Pedido, id_pedido)

    def _consulta_filtrada(self, id_usuario: int | None, estado: str | None, incluir_ocultos: bool):
        consulta = select(Pedido)
        if id_usuario is not None:
            consulta = consulta.where(Pedido.id_usuario_fk == id_usuario)
        if estado is not None:
            consulta = consulta.where(Pedido.estado == estado)
        if not incluir_ocultos:
            consulta = consulta.where(Pedido.oculto.is_(None) | (Pedido.oculto == False))
        return consulta

    def listar(self, saltar: int=0, limite: int=20, id_usuario: int | None=None, estado: str | None=None, incluir_ocultos: bool=True) -> list[Pedido]:
        consulta = self._consulta_filtrada(id_usuario, estado, incluir_ocultos)
        consulta = consulta.order_by(Pedido.id_pedido.desc()).offset(saltar).limit(limite)
        return list(self.sesion.scalars(consulta))

    def contar(self, id_usuario: int | None=None, estado: str | None=None, incluir_ocultos: bool=True) -> int:
        consulta = self._consulta_filtrada(id_usuario, estado, incluir_ocultos)
        return self.sesion.scalar(select(func.count()).select_from(consulta.subquery())) or 0

    def crear(self, id_usuario: int, estado: str) -> Pedido:
        pedido = Pedido(id_usuario_fk=id_usuario, fecha_pedido=datetime.now(), estado=estado, oculto=False)
        self.sesion.add(pedido)
        self.sesion.flush()
        return pedido

    def actualizar_estado(self, pedido: Pedido, estado: str) -> Pedido:
        pedido.estado = estado
        self.sesion.flush()
        return pedido

    def ocultar(self, pedido: Pedido) -> Pedido:
        pedido.oculto = True
        self.sesion.flush()
        return pedido

    def crear_detalle(self, id_pedido: int, id_producto: int, cantidad: int, precio_lista: Decimal, descuento_unitario: Decimal, precio_unitario: Decimal) -> DetallePedido:
        detalle = DetallePedido(id_pedido_fk=id_pedido, id_producto_fk=id_producto, cantidad=cantidad, precio_lista=precio_lista, descuento_unitario=descuento_unitario, precio_unitario=precio_unitario, inhabilitado=False)
        self.sesion.add(detalle)
        self.sesion.flush()
        return detalle

    def listar_detalles(self, id_pedido: int, incluir_inhabilitados: bool=False) -> list[DetallePedido]:
        consulta = select(DetallePedido).where(DetallePedido.id_pedido_fk == id_pedido)
        if not incluir_inhabilitados:
            consulta = consulta.where(DetallePedido.inhabilitado == False)
        consulta = consulta.order_by(DetallePedido.id_detalle_pedido)
        return list(self.sesion.scalars(consulta))
