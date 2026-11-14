from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.core.config import configuracion
from app.core.dependencies import (
    ROL_ADMINISTRADOR,
    ROL_VENDEDOR,
    SesionBD,
    UsuarioActual,
    requiere_rol,
    roles_de,
)
from app.core.exceptions import NoEncontrado
from app.core.pagination import PaginaRespuesta, ParametrosPaginacion
from app.schemas.venta import FacturaRespuesta, IngresoPorMes, VentaRespuesta
from app.services import venta as servicio
from app.services.reporte_excel import generar_reporte_vendedor_xlsx

router = APIRouter()

# Anular una venta (y su factura) es cosa de administrador o vendedor.
PuedeGestionar = Depends(requiere_rol(ROL_ADMINISTRADOR, ROL_VENDEDOR))

ROLES_QUE_VEN_TODO = {ROL_ADMINISTRADOR, ROL_VENDEDOR}


def _es_staff(usuario) -> bool:
    return bool(roles_de(usuario) & ROLES_QUE_VEN_TODO)


@router.get("", response_model=PaginaRespuesta[VentaRespuesta])
def listar(
    sesion: SesionBD,
    usuario: UsuarioActual,
    paginacion: ParametrosPaginacion = Depends(),
    estado: Optional[str] = Query(None, description="Completada o Anulada"),
    id_usuario: Optional[int] = Query(None, description="Solo administrador/vendedor"),
    id_pedido: Optional[int] = Query(None),
    fecha_desde: Optional[date] = Query(None, description="Fecha inicio (YYYY-MM-DD)"),
    fecha_hasta: Optional[date] = Query(None, description="Fecha fin (YYYY-MM-DD)"),
):
    """Listado de ventas.

    El cliente ve solo las suyas; administrador y vendedor ven todas.
    """
    staff = _es_staff(usuario)
    items, total = servicio.listar_ventas(
        sesion,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        id_usuario=id_usuario if staff else usuario.id_usuario,
        estado=estado,
        id_pedido=id_pedido,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
    )
    return PaginaRespuesta[VentaRespuesta](
        total=total,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        items=[VentaRespuesta.model_validate(v) for v in items],
    )


def _datos_empresa() -> dict:
    """Datos de la empresa que salen impresos en el reporte."""
    return {
        "razon_social": configuracion.dian_razon_social,
        "nombre_comercial": configuracion.dian_nombre_comercial,
        "nit": configuracion.dian_nit_emisor,
        "dv": configuracion.dian_dv_emisor,
        "direccion": configuracion.dian_direccion,
        "ciudad": configuracion.dian_ciudad,
        "telefono": configuracion.dian_telefono,
        "correo": configuracion.dian_correo,
    }


def _reporte_restringido_vendedor(usuario: UsuarioActual) -> None:
    """El reporte del vendedor es solo para el rol Vendedor."""
    from app.core.dependencies import ROL_VENDEDOR

    if ROL_VENDEDOR not in roles_de(usuario):
        from app.core.exceptions import Prohibido

        raise Prohibido(
            "El modulo de reportes es solo para el rol Vendedor. "
            "Cambia a ese rol para verlo."
        )


@router.get("/reportes/vendedor")
def reporte_vendedor(
    sesion: SesionBD,
    usuario: UsuarioActual,
    fecha_desde: Optional[date] = Query(None, description="Fecha inicio (YYYY-MM-DD)"),
    fecha_hasta: Optional[date] = Query(None, description="Fecha fin (YYYY-MM-DD)"),
    estado: Optional[str] = Query(None, description="Completada o Anulada"),
):
    """Reporte del vendedor: resumen, metodos de pago e historial de ventas."""
    _reporte_restringido_vendedor(usuario)

    reporte = servicio.reporte_vendedor(
        sesion,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        estado=estado,
    )

    return {
        "empresa": _datos_empresa(),
        "filtros": {
            "fecha_desde": fecha_desde.isoformat() if fecha_desde else None,
            "fecha_hasta": fecha_hasta.isoformat() if fecha_hasta else None,
            "estado": estado,
        },
        "resumen": {
            "ventas": reporte["ventas"],
            "total_unidades": reporte["total_unidades"],
            "total_ingresos": reporte["total_ingresos"],
        },
        "metodos_pago": reporte["metodos_pago"],
        "transacciones": reporte["transacciones"],
    }


@router.get("/reportes/vendedor/excel")
def reporte_vendedor_excel(
    sesion: SesionBD,
    usuario: UsuarioActual,
    fecha_desde: Optional[date] = Query(None, description="Fecha inicio (YYYY-MM-DD)"),
    fecha_hasta: Optional[date] = Query(None, description="Fecha fin (YYYY-MM-DD)"),
    estado: Optional[str] = Query(None, description="Completada o Anulada"),
):
    """Descarga del reporte del vendedor en Excel (.xlsx) con datos de la
    empresa, logo, resumen, metodos de pago e historial."""
    _reporte_restringido_vendedor(usuario)

    reporte = servicio.reporte_vendedor(
        sesion,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        estado=estado,
    )

    empresa = _datos_empresa()
    filtros = {
        "fecha_desde": fecha_desde.isoformat() if fecha_desde else None,
        "fecha_hasta": fecha_hasta.isoformat() if fecha_hasta else None,
        "estado": estado,
    }

    contenido = generar_reporte_vendedor_xlsx(reporte, empresa, filtros)

    # `generar_reporte_vendedor_xlsx` devuelve `bytes`. StreamingResponse lo
    # itera: si se pasa `bytes` en crudo, cada chunk es un entero (0-255) y
    # Starlette falla con "AttributeError: 'int' object has no attribute
    # 'encode'". Se envia como una lista con el bloque completo de bytes.
    return StreamingResponse(
        [contenido],
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="reporte-ventas-vendedor.xlsx"'
        },
    )


@router.get(
    "/estadisticas/ingresos-por-mes",
    response_model=list[IngresoPorMes],
    dependencies=[PuedeGestionar],
)
def ingresos_por_mes_endpoint(sesion: SesionBD):
    """Ingresos por mes (ventas Completadas) para la grafica del modulo de ventas.

    Requiere Administrador o Vendedor (el modulo de ventas es de staff).
    """
    return servicio.ingresos_por_mes(sesion)


@router.get("/{id_venta}", response_model=VentaRespuesta)
def detalle(id_venta: int, sesion: SesionBD, usuario: UsuarioActual):
    """Detalle de una venta con sus lineas y su factura."""
    if not _es_staff(usuario) and not servicio.es_del_usuario(
        sesion, id_venta, usuario.id_usuario
    ):
        raise NoEncontrado(f"No existe la venta con id {id_venta}")
    return servicio.obtener_venta(sesion, id_venta)


@router.get("/{id_venta}/factura", response_model=FacturaRespuesta)
def factura(id_venta: int, sesion: SesionBD, usuario: UsuarioActual):
    """Factura de la venta."""
    if not _es_staff(usuario) and not servicio.es_del_usuario(
        sesion, id_venta, usuario.id_usuario
    ):
        raise NoEncontrado(f"No existe la venta con id {id_venta}")
    return servicio.obtener_factura(sesion, id_venta)


@router.post(
    "/{id_venta}/anular",
    response_model=VentaRespuesta,
    dependencies=[PuedeGestionar],
)
def anular(id_venta: int, sesion: SesionBD):
    """Anula la venta y su factura. Requiere Administrador o Vendedor.

    REGLA DEL PROYECTO: no se elimina informacion. La venta queda en estado
    'Anulada' y se conserva con todas sus lineas. El inventario NO se devuelve
    aqui: eso lo hace el modulo de devoluciones con su motivo.
    """
    return servicio.anular_venta(sesion, id_venta)
