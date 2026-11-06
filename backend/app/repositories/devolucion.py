from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.detalle_venta import DetalleVenta
from app.models.devolucion import Devolucion
from app.models.venta import Venta
from app.schemas.devolucion import (
    ESTADO_APROBADA,
    ESTADO_PENDIENTE,
    ESTADO_RECHAZADA,
)

# Estados que descuentan cupo de la linea de venta.
ESTADOS_QUE_OCUPAN_CUPO = (ESTADO_PENDIENTE, ESTADO_APROBADA)


class DevolucionRepositorio:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    # --- consultas ------------------------------------------------------------

    def buscar_por_id(self, id_devolucion: int) -> Devolucion | None:
        return self.sesion.get(Devolucion, id_devolucion)

    def buscar_detalle(self, id_detalle_venta: int) -> DetalleVenta | None:
        return self.sesion.get(DetalleVenta, id_detalle_venta)

    def buscar_venta(self, id_venta: int) -> Venta | None:
        return self.sesion.get(Venta, id_venta)

    def _consulta_filtrada(
        self,
        id_usuario: int | None,
        estado: str | None,
        id_detalle_venta: int | None,
    ):
        """Devuelve las devoluciones y, si se pide, las filtra por dueño.

        Para saber quien es el dueño hay que pasar por la venta, porque la
        devolucion apunta a una linea de venta y no al usuario directamente.
        """
        consulta = select(Devolucion).join(
            DetalleVenta, Devolucion.id_detalle_venta_fk == DetalleVenta.id_detalle_venta
        )
        if id_usuario is not None:
            consulta = consulta.join(
                Venta, DetalleVenta.id_venta_fk == Venta.id_venta
            ).where(Venta.id_usuario_fk == id_usuario)
        if estado is not None:
            consulta = consulta.where(Devolucion.estado == estado)
        if id_detalle_venta is not None:
            consulta = consulta.where(
                Devolucion.id_detalle_venta_fk == id_detalle_venta
            )
        return consulta

    def listar(
        self,
        saltar: int = 0,
        limite: int = 20,
        id_usuario: int | None = None,
        estado: str | None = None,
        id_detalle_venta: int | None = None,
    ) -> list[Devolucion]:
        consulta = self._consulta_filtrada(id_usuario, estado, id_detalle_venta)
        consulta = (
            consulta.order_by(Devolucion.id_devolucion.desc())
            .offset(saltar)
            .limit(limite)
        )
        return list(self.sesion.scalars(consulta))

    def contar(
        self,
        id_usuario: int | None = None,
        estado: str | None = None,
        id_detalle_venta: int | None = None,
    ) -> int:
        consulta = self._consulta_filtrada(id_usuario, estado, id_detalle_venta)
        return self.sesion.scalar(
            select(func.count()).select_from(consulta.subquery())
        ) or 0

    def cantidad_comprometida(self, id_detalle_venta: int) -> int:
        """Unidades ya pedidas o aprobadas en esa linea (lo que ocupa cupo)."""
        return self.sesion.scalar(
            select(func.coalesce(func.sum(Devolucion.cantidad), 0)).where(
                Devolucion.id_detalle_venta_fk == id_detalle_venta,
                Devolucion.estado.in_(ESTADOS_QUE_OCUPAN_CUPO),
            )
        ) or 0

    def cantidad_aprobada(self, id_detalle_venta: int) -> int:
        """Unidades realmente aceptadas como devueltas en esa linea."""
        return self.sesion.scalar(
            select(func.coalesce(func.sum(Devolucion.cantidad), 0)).where(
                Devolucion.id_detalle_venta_fk == id_detalle_venta,
                Devolucion.estado == ESTADO_APROBADA,
            )
        ) or 0

    # --- escritura ------------------------------------------------------------

    def crear(
        self,
        id_detalle_venta: int,
        cantidad: int,
        motivo: str,
        estado: str = ESTADO_PENDIENTE,
    ) -> Devolucion:
        devolucion = Devolucion(
            id_detalle_venta_fk=id_detalle_venta,
            cantidad=cantidad,
            motivo=motivo,
            fecha_devolucion=date.today(),
            estado=estado,
        )
        self.sesion.add(devolucion)
        self.sesion.flush()
        return devolucion

    def cambiar_estado(self, devolucion: Devolucion, nuevo_estado: str) -> Devolucion:
        """Baja logica pura: se cambia el estado, nunca se borra el registro."""
        devolucion.estado = nuevo_estado
        self.sesion.flush()
        return devolucion


__all__ = [
    "DevolucionRepositorio",
    "ESTADOS_QUE_OCUPAN_CUPO",
    "ESTADO_APROBADA",
    "ESTADO_PENDIENTE",
    "ESTADO_RECHAZADA",
]