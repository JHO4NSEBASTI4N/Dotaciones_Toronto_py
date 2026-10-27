"""Acceso a datos de descuentos. No hace commit: eso lo cierra el servicio."""

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.descuento import Descuento
from app.schemas.descuento import DescuentoActualizar, DescuentoCrear


class DescuentoRepositorio:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def buscar_por_id(self, id_descuento: int) -> Descuento | None:
        return self.sesion.get(Descuento, id_descuento)

    def _consulta_filtrada(
        self,
        id_producto: int | None,
        tipo_descuento: str | None,
        activo: bool | None,
    ):
        consulta = select(Descuento)
        if id_producto is not None:
            consulta = consulta.where(Descuento.id_producto_fk == id_producto)
        if tipo_descuento is not None:
            consulta = consulta.where(Descuento.tipo_descuento == tipo_descuento)
        if activo is not None:
            consulta = consulta.where(Descuento.activo == activo)
        return consulta

    def listar(
        self,
        saltar: int = 0,
        limite: int = 20,
        id_producto: int | None = None,
        tipo_descuento: str | None = None,
        activo: bool | None = None,
    ) -> list[Descuento]:
        consulta = self._consulta_filtrada(id_producto, tipo_descuento, activo)
        consulta = (
            consulta.order_by(Descuento.id_descuento).offset(saltar).limit(limite)
        )
        return list(self.sesion.scalars(consulta))

    def contar(
        self,
        id_producto: int | None = None,
        tipo_descuento: str | None = None,
        activo: bool | None = None,
    ) -> int:
        consulta = self._consulta_filtrada(id_producto, tipo_descuento, activo)
        return self.sesion.scalar(
            select(func.count()).select_from(consulta.subquery())
        ) or 0

    def buscar_activo_por_producto(self, id_producto: int) -> Descuento | None:
        """El descuento vigente de un producto (a lo sumo uno, ver el servicio)."""
        return self.sesion.scalar(
            select(Descuento)
            .where(
                Descuento.id_producto_fk == id_producto,
                Descuento.activo == True,  # noqa: E712
            )
            .order_by(Descuento.id_descuento.desc())
        )

    def crear(self, datos: DescuentoCrear) -> Descuento:
        descuento = Descuento(**datos.model_dump(), activo=True)
        self.sesion.add(descuento)
        self.sesion.flush()
        return descuento

    def actualizar(
        self, descuento: Descuento, datos: DescuentoActualizar
    ) -> Descuento:
        for campo, valor in datos.model_dump(exclude_unset=True).items():
            setattr(descuento, campo, valor)
        self.sesion.flush()
        return descuento

    def desactivar(self, descuento: Descuento) -> Descuento:
        """Baja logica: la fila se conserva para el historial de pedidos."""
        descuento.activo = False
        self.sesion.flush()
        return descuento

    def activar(self, descuento: Descuento) -> Descuento:
        descuento.activo = True
        self.sesion.flush()
        return descuento

    def desactivar_activos_de_producto(self, id_producto: int) -> int:
        """Apaga todos los descuentos vigentes del producto y devuelve cuantos eran.

        Se usa para garantizar la regla "un solo descuento activo por producto"
        sin borrar nada: los anteriores quedan inactivos como historial.
        """
        resultado = self.sesion.execute(
            update(Descuento)
            .where(
                Descuento.id_producto_fk == id_producto,
                Descuento.activo == True,  # noqa: E712
            )
            .values(activo=False)
        )
        self.sesion.flush()
        return resultado.rowcount or 0
