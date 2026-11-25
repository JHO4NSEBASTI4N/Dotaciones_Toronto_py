"""Inicialización idempotente de la numeración DIAN en modo simulado.

En desarrollo/simulación evita que cada entrega quede sin factura solo porque
no se cargó manualmente una resolución. Esta numeración es explícitamente de
prueba; jamás se crea ni se usa para el proveedor DIAN real.
"""
from __future__ import annotations

import logging
import sys

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import configuracion
from app.models.resolucion_facturacion import ResolucionFacturacion
from app.repositories.factura_electronica import ResolucionRepositorio

registro = logging.getLogger("dotaciones.inicializador.dian")


def asegurar_resolucion_simulada(sesion: Session, *, confirmar: bool = True) -> bool:
    """Crea una numeración SIM de prueba solo si falta resolución vigente.

    Devuelve True si la creó. La marca/prefijo SIM y el aviso fiscal dejan claro
    que no es una autorización de numeración otorgada por la DIAN.
    """
    if (configuracion.dian_proveedor or "").strip().lower() != "simulado":
        return False

    repositorio = ResolucionRepositorio(sesion)
    if repositorio.buscar_vigente(tipo_documento="01") is not None:
        return False

    resolucion = ResolucionFacturacion(
        tipo_documento="01",
        numero_resolucion="SIMULADA",
        prefijo="SIM",
        rango_desde=1,
        rango_hasta=999999,
        consecutivo_actual=0,
        clave_tecnica="",
        vigencia_desde=None,
        vigencia_hasta=None,
        vigente=True,
        notificacion=(
            "Numeración automática para modo simulado. No es una resolución "
            "DIAN ni tiene validez fiscal."
        ),
    )
    sesion.add(resolucion)
    if confirmar:
        sesion.commit()
    else:
        sesion.flush()
    registro.warning(
        "Se creó numeración DIAN SIMULADA (SIM-000001…). No tiene validez fiscal."
    )
    return True


def crear_resolucion_simulada_al_arrancar() -> None:
    """Asegura la resolución ficticia solo en el proveedor simulado.

    Las pruebas no deben conectarse a la base configurada por el usuario. En
    producción real no genera permisos legales ni números de factura falsos.
    """
    if (configuracion.dian_proveedor or "").strip().lower() != "simulado":
        return
    if "pytest" in sys.modules:
        return

    from app.database.connection import SessionLocal

    sesion = SessionLocal()
    try:
        asegurar_resolucion_simulada(sesion)
    except SQLAlchemyError as error:
        sesion.rollback()
        registro.error(
            "No se pudo inicializar la numeración DIAN simulada (%s). "
            "Verifica que las tablas DIAN existan en la base de datos.",
            type(error).__name__,
        )
    finally:
        sesion.close()
