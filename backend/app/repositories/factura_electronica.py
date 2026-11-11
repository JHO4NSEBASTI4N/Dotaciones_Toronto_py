"""Acceso a datos de la factura electronica y sus resoluciones.

No hace commit: la transaccion la cierra el servicio. Nada se borra: la
anulacion es un cambio de estado.
"""

from datetime import date
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.factura_electronica import FacturaElectronica
from app.models.factura_electronica_detalle import FacturaElectronicaDetalle
from app.models.factura_electronica_evento import FacturaElectronicaEvento
from app.models.resolucion_facturacion import ResolucionFacturacion


class ResolucionRepositorio:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def listar(self, saltar: int = 0, limite: int = 20, solo_vigentes: bool = False):
        base = select(ResolucionFacturacion)
        if solo_vigentes:
            base = base.where(ResolucionFacturacion.vigente.is_(True))

        total = self.sesion.scalar(select(func.count()).select_from(base.subquery())) or 0
        consulta = (
            base.order_by(ResolucionFacturacion.id_resolucion)
            .offset(saltar)
            .limit(limite)
        )
        return list(self.sesion.scalars(consulta)), total

    def buscar_por_id(self, id_resolucion: int) -> Optional[ResolucionFacturacion]:
        return self.sesion.get(ResolucionFacturacion, id_resolucion)

    def buscar_vigente(
        self, tipo_documento: str = "01", hoy: Optional[date] = None
    ) -> Optional[ResolucionFacturacion]:
        """La resolucion con la que se debe facturar HOY.

        Vigente = marcada como vigente Y con la fecha de hoy dentro del rango
        de vigencia. Si hay varias, se toma la de mayor id (la ultima creada).
        """
        hoy = hoy or date.today()
        consulta = (
            select(ResolucionFacturacion)
            .where(
                ResolucionFacturacion.tipo_documento == tipo_documento,
                ResolucionFacturacion.vigente.is_(True),
                or_(
                    ResolucionFacturacion.vigencia_desde.is_(None),
                    ResolucionFacturacion.vigencia_desde <= hoy,
                ),
                or_(
                    ResolucionFacturacion.vigencia_hasta.is_(None),
                    ResolucionFacturacion.vigencia_hasta >= hoy,
                ),
            )
            .order_by(ResolucionFacturacion.id_resolucion.desc())
        )
        return self.sesion.scalars(consulta).first()

    def crear(self, datos: dict) -> ResolucionFacturacion:
        resolucion = ResolucionFacturacion(**datos)
        self.sesion.add(resolucion)
        self.sesion.flush()
        return resolucion


class FacturaElectronicaRepositorio:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    # --- consultas ------------------------------------------------------

    def buscar_por_id(self, id_factura: int) -> Optional[FacturaElectronica]:
        return self.sesion.get(FacturaElectronica, id_factura)

    def buscar_por_venta(self, id_venta: int) -> Optional[FacturaElectronica]:
        """La factura electronica de una venta.

        Se ignoran las ANULADAS: si se anulo y se volvio a generar, la que
        vale es la nueva.
        """
        consulta = (
            select(FacturaElectronica)
            .where(
                FacturaElectronica.id_venta_fk == id_venta,
                FacturaElectronica.estado != "ANULADA",
            )
            .order_by(FacturaElectronica.id_factura.desc())
        )
        return self.sesion.scalars(consulta).first()

    def buscar_por_numero(self, numero: str) -> Optional[FacturaElectronica]:
        consulta = select(FacturaElectronica).where(
            FacturaElectronica.numero_factura == numero
        )
        return self.sesion.scalars(consulta).first()

    def listar(
        self,
        saltar: int = 0,
        limite: int = 20,
        estado: Optional[str] = None,
        estado_dian: Optional[str] = None,
        id_venta: Optional[int] = None,
        numero: Optional[str] = None,
        desde: Optional[date] = None,
        hasta: Optional[date] = None,
    ) -> tuple[list[FacturaElectronica], int]:
        condiciones = []
        if estado:
            condiciones.append(func.upper(FacturaElectronica.estado) == estado.upper())
        if estado_dian:
            condiciones.append(
                func.upper(FacturaElectronica.estado_dian) == estado_dian.upper()
            )
        if id_venta is not None:
            condiciones.append(FacturaElectronica.id_venta_fk == id_venta)
        if numero:
            condiciones.append(
                FacturaElectronica.numero_factura.like(f"%{numero}%")
            )
        if desde is not None:
            condiciones.append(FacturaElectronica.fecha_emision >= desde)
        if hasta is not None:
            condiciones.append(FacturaElectronica.fecha_emision <= hasta)

        base = select(FacturaElectronica)
        if condiciones:
            base = base.where(*condiciones)

        total = self.sesion.scalar(select(func.count()).select_from(base.subquery())) or 0
        consulta = (
            base.order_by(FacturaElectronica.id_factura.desc())
            .offset(saltar)
            .limit(limite)
        )
        return list(self.sesion.scalars(consulta)), total

    def listar_lineas(self, id_factura: int) -> list[FacturaElectronicaDetalle]:
        consulta = (
            select(FacturaElectronicaDetalle)
            .where(FacturaElectronicaDetalle.id_factura_fk == id_factura)
            .order_by(FacturaElectronicaDetalle.numero_linea)
        )
        return list(self.sesion.scalars(consulta))

    def listar_eventos(self, id_factura: int) -> list[FacturaElectronicaEvento]:
        consulta = (
            select(FacturaElectronicaEvento)
            .where(FacturaElectronicaEvento.id_factura_fk == id_factura)
            .order_by(FacturaElectronicaEvento.id_evento)
        )
        return list(self.sesion.scalars(consulta))

    # --- escritura ------------------------------------------------------

    def crear(self, datos: dict) -> FacturaElectronica:
        factura = FacturaElectronica(**datos)
        self.sesion.add(factura)
        self.sesion.flush()
        return factura

    def crear_linea(self, datos: dict) -> FacturaElectronicaDetalle:
        linea = FacturaElectronicaDetalle(**datos)
        self.sesion.add(linea)
        self.sesion.flush()
        return linea

    def crear_evento(self, datos: dict) -> FacturaElectronicaEvento:
        evento = FacturaElectronicaEvento(**datos)
        self.sesion.add(evento)
        self.sesion.flush()
        return evento
