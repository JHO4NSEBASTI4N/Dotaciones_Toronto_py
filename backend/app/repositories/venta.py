from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.detalle_venta import DetalleVenta
from app.models.devolucion import Devolucion
from app.models.factura import Factura
from app.models.usuario import Usuario
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
        fecha_desde: datetime | None = None,
        fecha_hasta: datetime | None = None,
    ):
        consulta = select(Venta)
        if id_usuario is not None:
            consulta = consulta.where(Venta.id_usuario_fk == id_usuario)
        if estado is not None:
            consulta = consulta.where(Venta.estado == estado)
        if id_pedido is not None:
            consulta = consulta.where(Venta.id_pedido_fk == id_pedido)
        if fecha_desde is not None:
            consulta = consulta.where(Venta.fecha_venta >= fecha_desde)
        if fecha_hasta is not None:
            # `fecha_hasta` incluye todo el dia: se compara contra el dia siguiente.
            consulta = consulta.where(Venta.fecha_venta < fecha_hasta + timedelta(days=1))
        return consulta

    def listar(
        self,
        saltar: int = 0,
        limite: int = 20,
        id_usuario: int | None = None,
        estado: str | None = None,
        id_pedido: int | None = None,
        fecha_desde: datetime | None = None,
        fecha_hasta: datetime | None = None,
    ) -> list[Venta]:
        consulta = self._consulta_filtrada(
            id_usuario, estado, id_pedido, fecha_desde, fecha_hasta
        )
        consulta = consulta.order_by(Venta.id_venta.desc()).offset(saltar).limit(limite)
        return list(self.sesion.scalars(consulta))

    def contar(
        self,
        id_usuario: int | None = None,
        estado: str | None = None,
        id_pedido: int | None = None,
        fecha_desde: datetime | None = None,
        fecha_hasta: datetime | None = None,
    ) -> int:
        consulta = self._consulta_filtrada(
            id_usuario, estado, id_pedido, fecha_desde, fecha_hasta
        )
        return self.sesion.scalar(
            select(func.count()).select_from(consulta.subquery())
        ) or 0

    def ingresos_por_mes(self) -> list[tuple[str, float, int]]:
        """Ingresos agrupados por mes (YYYY-MM) de ventas Completadas.

        Devuelve tuplas (periodo, ingreso, ventas) ordenadas por periodo.
        Se usa para la grafica del modulo de ventas.
        """
        consulta = (
            select(
                func.date_format(Venta.fecha_venta, "%Y-%m").label("periodo"),
                func.coalesce(func.sum(Venta.total_pagado), 0.0).label("ingreso"),
                func.count(Venta.id_venta).label("ventas"),
            )
            .where(Venta.estado == "Completada", Venta.fecha_venta.is_not(None))
            .group_by("periodo")
            .order_by("periodo")
        )
        return [tuple(fila) for fila in self.sesion.execute(consulta)]

    def crear(
        self,
        id_usuario: int | None,
        id_pedido: int | None,
        total_pagado: Decimal,
        estado: str = "Completada",
        metodo_pago: str | None = None,
    ) -> Venta:
        venta = Venta(
            id_usuario_fk=id_usuario,
            id_pedido_fk=id_pedido,
            fecha_venta=datetime.now(),
            # La columna es double en la base: se guarda como float.
            total_pagado=float(total_pagado),
            estado=estado,
            metodo_pago=metodo_pago,
        )
        self.sesion.add(venta)
        self.sesion.flush()
        return venta

    def reporte_vendedor(
        self,
        id_usuario: int | None = None,
        estado: str | None = None,
        fecha_desde: datetime | None = None,
        fecha_hasta: datetime | None = None,
    ) -> dict:
        """Resumen del vendedor para el modulo de reportes.

        Devuelve: total de ventas, total de unidades (productos vendidos),
        total de ingresos, desglose por metodo de pago y el historial de
        transacciones con el nombre del cliente.
        """
        condiciones = []
        if id_usuario is not None:
            condiciones.append(Venta.id_usuario_fk == id_usuario)
        if estado is not None:
            condiciones.append(Venta.estado == estado)
        if fecha_desde is not None:
            condiciones.append(Venta.fecha_venta >= fecha_desde)
        if fecha_hasta is not None:
            condiciones.append(Venta.fecha_venta < fecha_hasta + timedelta(days=1))

        filas = self.sesion.execute(
            select(Venta, Usuario.nombre)
            .join(Usuario, Venta.id_usuario_fk == Usuario.id_usuario, isouter=True)
            .where(*condiciones)
            .order_by(Venta.fecha_venta.desc(), Venta.id_venta.desc())
        ).all()

        # Las unidades vendidas NO viven en la tabla `venta`: se suman de
        # `detalle_venta.cantidad` (la tabla venta solo guarda el total).
        ids_venta = [venta.id_venta for venta, _nombre in filas]
        mapa_unidades: dict[int, int] = {}
        if ids_venta:
            filas_unidades = self.sesion.execute(
                select(DetalleVenta.id_venta_fk, func.sum(DetalleVenta.cantidad))
                .where(DetalleVenta.id_venta_fk.in_(ids_venta))
                .group_by(DetalleVenta.id_venta_fk)
            ).all()
            mapa_unidades = {
                id_venta: int(unidades or 0)
                for id_venta, unidades in filas_unidades
            }

        total_ingresos = 0.0
        total_unidades = 0
        mapa_pago: dict[str, dict] = {}

        for venta, _nombre in filas:
            ingreso = float(venta.total_pagado or 0)
            unidades = mapa_unidades.get(venta.id_venta, 0)

            total_ingresos += ingreso
            total_unidades += unidades

            metodo = (venta.metodo_pago or "").strip() or "Sin especificar"
            if metodo not in mapa_pago:
                mapa_pago[metodo] = {"metodo": metodo, "ingreso": 0.0, "ventas": 0}
            mapa_pago[metodo]["ingreso"] += ingreso
            mapa_pago[metodo]["ventas"] += 1

        metodos_pago = sorted(
            mapa_pago.values(), key=lambda m: m["ingreso"], reverse=True
        )

        return {
            "ventas": len(filas),
            "total_unidades": total_unidades,
            "total_ingresos": round(total_ingresos, 2),
            "metodos_pago": [
                {
                    "metodo": m["metodo"],
                    "ingreso": round(m["ingreso"], 2),
                    "ventas": m["ventas"],
                }
                for m in metodos_pago
            ],
            "transacciones": [
                {
                    "id_venta": venta.id_venta,
                    "fecha_venta": venta.fecha_venta,
                    "estado": venta.estado,
                    "total_pagado": round(float(venta.total_pagado or 0), 2),
                    "total_unidades": mapa_unidades.get(venta.id_venta, 0),
                    "metodo_pago": venta.metodo_pago,
                    "cliente": nombre or "—",
                }
                for venta, nombre in filas
            ],
        }

    def anular(self, venta: Venta) -> Venta:
        """Baja logica: la venta se conserva con estado 'Anulada'."""
        venta.estado = "Anulada"
        self.sesion.flush()
        return venta

    def reactivar(self, venta: Venta, metodo_pago: str | None = None) -> Venta:
        """Reactiva una venta previamente anulada al volver a entregar el pedido."""
        venta.estado = "Completada"
        venta.fecha_venta = datetime.now()
        if metodo_pago is not None:
            venta.metodo_pago = metodo_pago
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

    def reactivar_factura(self, factura: Factura) -> Factura:
        factura.estado = "Vigente"
        factura.fecha_factura = datetime.now()
        self.sesion.flush()
        return factura