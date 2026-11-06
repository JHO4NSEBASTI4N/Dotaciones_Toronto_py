from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.detalle_venta import DetalleVenta
from app.models.devolucion import Devolucion
from app.models.factura import Factura
from app.models.venta import Venta


class VentaRepositorio:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    # --- venta ---------------------------------------------------------------

    def buscar_por_id(self, id_venta: int) -> Venta | None:
        return self.sesion.get(Venta, id_venta)

    def buscar_por_pedido(self, id_pedido: int) -> Venta | None:
        """IDEMPOTENCIA: un pedido tiene como maximo una venta.

        Replica ventaRepository.findByIdPedido() del proyecto Java: si ya
        existe, se devuelve en vez de crear otra.
        """
        return self.sesion.scalar(
            select(Venta)
            .where(Venta.id_pedido_fk == id_pedido)
            .order_by(Venta.id_venta.desc())
        )

    def _consulta_filtrada(
        self,
        id_usuario: int | None,
        estado: str | None,
        id_pedido: int | None,
    ):
        consulta = select(Venta)
        if id_usuario is not None:
            consulta = consulta.where(Venta.id_usuario_fk == id_usuario)
        if estado is not None:
            consulta = consulta.where(Venta.estado == estado)
        if id_pedido is not None:
            consulta = consulta.where(Venta.id_pedido_fk == id_pedido)
        return consulta

    def listar(
        self,
        saltar: int = 0,
        limite: int = 20,
        id_usuario: int | None = None,
        estado: str | None = None,
        id_pedido: int | None = None,
    ) -> list[Venta]:
        consulta = self._consulta_filtrada(id_usuario, estado, id_pedido)
        consulta = consulta.order_by(Venta.id_venta.desc()).offset(saltar).limit(limite)
        return list(self.sesion.scalars(consulta))

    def contar(
        self,
        id_usuario: int | None = None,
        estado: str | None = None,
        id_pedido: int | None = None,
    ) -> int:
        consulta = self._consulta_filtrada(id_usuario, estado, id_pedido)
        return self.sesion.scalar(
            select(func.count()).select_from(consulta.subquery())
        ) or 0

    def crear(
        self,
        id_usuario: int | None,
        id_pedido: int | None,
        total_pagado: Decimal,
        estado: str = "Completada",
    ) -> Venta:
        venta = Venta(
            id_usuario_fk=id_usuario,
            id_pedido_fk=id_pedido,
            fecha_venta=datetime.now(),
            # La columna es double en la base: se guarda como float.
            total_pagado=float(total_pagado),
            estado=estado,
        )
        self.sesion.add(venta)
        self.sesion.flush()
        return venta

    def anular(self, venta: Venta) -> Venta:
        """Baja logica: la venta se conserva con estado 'Anulada'."""
        venta.estado = "Anulada"
        self.sesion.flush()
        return venta

    # --- detalle de venta ----------------------------------------------------

    def crear_detalle(
        self,
        id_venta: int,
        id_producto: int,
        cantidad: int,
        precio_lista: Decimal | None,
        descuento_unitario: Decimal,
        precio_unitario: Decimal,
    ) -> DetalleVenta:
        detalle = DetalleVenta(
            id_venta_fk=id_venta,
            id_producto_fk=id_producto,
            cantidad=cantidad,
            precio_lista=precio_lista,
            descuento_unitario=descuento_unitario,
            precio_unitario=precio_unitario,
            inhabilitado=False,
        )
        self.sesion.add(detalle)
        self.sesion.flush()
        return detalle

    def listar_detalles(
        self, id_venta: int, incluir_inhabilitados: bool = False
    ) -> list[DetalleVenta]:
        consulta = select(DetalleVenta).where(DetalleVenta.id_venta_fk == id_venta)
        if not incluir_inhabilitados:
            consulta = consulta.where(
                DetalleVenta.inhabilitado == False  # noqa: E712
            )
        consulta = consulta.order_by(DetalleVenta.id_detalle_venta)
        return list(self.sesion.scalars(consulta))

    def cantidad_devuelta(self, id_detalle_venta: int) -> int:
        """Cuanto de esa linea se devolvio REALMENTE.

        Solo cuentan las devoluciones *Aprobadas*: una rechazada nunca
        devolvio nada y una pendiente todavia esta en tramite. El cupo
        disponible se calcula en el modulo de devoluciones.
        """
        return self.sesion.scalar(
            select(func.coalesce(func.sum(Devolucion.cantidad), 0)).where(
                Devolucion.id_detalle_venta_fk == id_detalle_venta,
                Devolucion.estado == "Aprobada",
            )
        ) or 0

    # --- factura -------------------------------------------------------------

    def crear_factura(
        self, id_venta: int, total_factura: Decimal, estado: str = "Vigente"
    ) -> Factura:
        factura = Factura(
            id_venta_fk=id_venta,
            total_factura=total_factura,
            fecha_factura=datetime.now(),
            estado=estado,
        )
        self.sesion.add(factura)
        self.sesion.flush()
        return factura

    def buscar_factura_de_venta(self, id_venta: int) -> Factura | None:
        return self.sesion.scalar(
            select(Factura)
            .where(Factura.id_venta_fk == id_venta)
            .order_by(Factura.id_factura.desc())
        )

    def anular_factura(self, factura: Factura) -> Factura:
        factura.estado = "Anulada"
        self.sesion.flush()
        return factura