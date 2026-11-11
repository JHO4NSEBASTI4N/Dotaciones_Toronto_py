"""Endpoints de facturacion electronica DIAN.

    /facturas-electronicas      el documento
    /resoluciones-facturacion   la autorizacion de numeracion

Quien puede que:
  - Sacar el XML o consultar una factura: Administrador, Vendedor o el propio
    cliente (solo las suyas).
  - Generar, firmar, enviar, anular y administrar resoluciones: Administrador
    y Vendedor.
  - Crear o cambiar resoluciones: solo Administrador (es un dato fiscal).

No hay DELETE: la anulacion es `estado = "ANULADA"`.
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response, status

from app.core.dependencies import (
    ROL_ADMINISTRADOR,
    ROL_VENDEDOR,
    SesionBD,
    UsuarioActual,
    requiere_rol,
    roles_de,
)
from app.core.exceptions import Prohibido
from app.core.pagination import PaginaRespuesta, ParametrosPaginacion
from app.schemas.factura_electronica import (
    EnviarFacturaEntrada,
    FacturaElectronicaDetalleRespuesta,
    FacturaElectronicaRespuesta,
    EventoFacturaRespuesta,
    GenerarFacturaEntrada,
    ResolucionActualizar,
    ResolucionCrear,
    ResolucionRespuesta,
)
from app.services import factura_electronica as servicio

router = APIRouter()

GestionaFactura = Depends(requiere_rol(ROL_ADMINISTRADOR, ROL_VENDEDOR))
SoloAdmin = Depends(requiere_rol(ROL_ADMINISTRADOR))


# --- resoluciones de facturacion ---------------------------------------------

@router.get(
    "/resoluciones",
    response_model=PaginaRespuesta[ResolucionRespuesta],
)
def listar_resoluciones(
    sesion: SesionBD,
    paginacion: ParametrosPaginacion = Depends(),
    solo_vigentes: bool = Query(False, description="Solo las que estan vigentes"),
    _=GestionaFactura,
):
    """Resoluciones de facturacion registradas."""
    items, total = servicio.listar_resoluciones(
        sesion,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        solo_vigentes=solo_vigentes,
    )
    return PaginaRespuesta[ResolucionRespuesta](
        total=total,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        items=[ResolucionRespuesta.model_validate(r) for r in items],
    )


@router.get(
    "/resoluciones/{id_resolucion}", response_model=ResolucionRespuesta
)
def detalle_resolucion(id_resolucion: int, sesion: SesionBD, _=GestionaFactura):
    return servicio.obtener_resolucion(sesion, id_resolucion)


@router.post(
    "/resoluciones",
    response_model=ResolucionRespuesta,
    status_code=status.HTTP_201_CREATED,
    dependencies=[SoloAdmin],
)
def crear_resolucion(datos: ResolucionCrear, sesion: SesionBD):
    """Registra una resolucion de la DIAN y la deja como la vigente.

    Al crearla, las demas del mismo tipo quedan como no vigentes: la DIAN solo
    permite numerar con una a la vez.
    """
    return servicio.crear_resolucion(sesion, datos)


@router.patch(
    "/resoluciones/{id_resolucion}",
    response_model=ResolucionRespuesta,
    dependencies=[SoloAdmin],
)
def actualizar_resolucion(
    id_resolucion: int, datos: ResolucionActualizar, sesion: SesionBD
):
    return servicio.actualizar_resolucion(sesion, id_resolucion, datos)


@router.post(
    "/resoluciones/{id_resolucion}/vigente",
    response_model=ResolucionRespuesta,
    dependencies=[SoloAdmin],
)
def marcar_vigente(id_resolucion: int, sesion: SesionBD):
    """Deja esta resolucion como la unica vigente de su tipo."""
    return servicio.marcar_resolucion_vigente(sesion, id_resolucion, True)


# --- facturas electronicas ----------------------------------------------------

@router.get(
    "",
    response_model=PaginaRespuesta[FacturaElectronicaRespuesta],
)
def listar(
    sesion: SesionBD,
    usuario: UsuarioActual,
    paginacion: ParametrosPaginacion = Depends(),
    estado: Optional[str] = Query(None, description="BORRADOR, FIRMADA, ACEPTADA..."),
    estado_dian: Optional[str] = Query(None),
    id_venta: Optional[int] = Query(None),
    numero: Optional[str] = Query(None, description="Busqueda parcial por numero"),
    desde: Optional[date] = Query(None),
    hasta: Optional[date] = Query(None),
):
    """Listado de facturas electronicas.

    El cliente solo ve las suyas; el Administrador y el Vendedor ven todas.
    """
    items, total = servicio.listar_facturas(
        sesion,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        estado=estado,
        estado_dian=estado_dian,
        id_venta=id_venta,
        numero=numero,
        desde=desde,
        hasta=hasta,
    )

    es_gestor = bool(roles_de(usuario) & {ROL_ADMINISTRADOR, ROL_VENDEDOR})
    if not es_gestor:
        items = [f for f in items if f["id_cliente_fk"] == usuario.id_usuario]
        total = len(items)

    return PaginaRespuesta[FacturaElectronicaRespuesta](
        total=total,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        items=[FacturaElectronicaRespuesta.model_validate(f) for f in items],
    )


@router.post(
    "",
    response_model=FacturaElectronicaDetalleRespuesta,
    status_code=status.HTTP_201_CREATED,
    dependencies=[GestionaFactura],
)
def generar(datos: GenerarFacturaEntrada, sesion: SesionBD):
    """Genera la factura electronica de una venta en estado BORRADOR.

    Calcula el CUFE, arma el XML UBL 2.1, asigna el consecutivo de la
    resolucion vigente y guarda las lineas con su IVA.
    """
    return servicio.generar_factura(sesion, datos)


@router.get("/por-venta/{id_venta}", response_model=FacturaElectronicaDetalleRespuesta)
def por_venta(id_venta: int, sesion: SesionBD, usuario: UsuarioActual, _=GestionaFactura):
    """La factura electronica de una venta (404 si no se ha generado)."""
    items, _total = servicio.listar_facturas(sesion, limite=100, id_venta=id_venta)
    if not items:
        from app.core.exceptions import NoEncontrado

        raise NoEncontrado(f"La venta {id_venta} no tiene factura electronica")

    return servicio.obtener_factura(sesion, items[0]["id_factura"])


@router.get("/{id_factura}", response_model=FacturaElectronicaDetalleRespuesta)
def detalle(id_factura: int, sesion: SesionBD, usuario: UsuarioActual):
    """Documento completo con sus lineas y su bitacora."""
    factura = servicio.obtener_factura(sesion, id_factura)

    es_gestor = bool(roles_de(usuario) & {ROL_ADMINISTRADOR, ROL_VENDEDOR})
    if not es_gestor and factura["id_cliente_fk"] != usuario.id_usuario:
        raise Prohibido("Solo puede consultar sus propias facturas")

    return factura


@router.get("/{id_factura}/xml")
def xml(id_factura: int, sesion: SesionBD, usuario: UsuarioActual):
    """Devuelve el XML UBL 2.1 como archivo descargable."""
    factura = servicio.obtener_factura(sesion, id_factura)

    es_gestor = bool(roles_de(usuario) & {ROL_ADMINISTRADOR, ROL_VENDEDOR})
    if not es_gestor and factura["id_cliente_fk"] != usuario.id_usuario:
        raise Prohibido("Solo puede consultar sus propias facturas")

    contenido = servicio.obtener_xml(sesion, id_factura)

    return Response(
        content=contenido,
        media_type="application/xml",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{factura["numero_factura"]}.xml"'
            )
        },
    )


@router.get(
    "/{id_factura}/eventos",
    response_model=list[EventoFacturaRespuesta],
)
def eventos(id_factura: int, sesion: SesionBD, _=GestionaFactura):
    """Bitacora: generacion, firma, envios y respuestas."""
    return servicio.listar_eventos(sesion, id_factura)


@router.post(
    "/{id_factura}/firmar",
    response_model=FacturaElectronicaDetalleRespuesta,
    dependencies=[GestionaFactura],
)
def firmar(id_factura: int, sesion: SesionBD):
    """Marca el documento como firmado (simulado si no hay certificado)."""
    return servicio.firmar_factura(sesion, id_factura)


@router.post(
    "/{id_factura}/enviar",
    response_model=FacturaElectronicaDetalleRespuesta,
    dependencies=[GestionaFactura],
)
def enviar(
    id_factura: int,
    sesion: SesionBD,
    datos: Optional[EnviarFacturaEntrada] = None,
):
    """Envia el documento al proveedor y guarda la respuesta.

    Sin cuerpo en la peticion tambien funciona. Para reenviar una factura ya
    aceptada hay que mandar `{"forzar_reenvio": true}`.
    """
    forzar = bool(datos and datos.forzar_reenvio)
    return servicio.enviar_factura(sesion, id_factura, forzar)


@router.post(
    "/{id_factura}/consultar-estado",
    response_model=FacturaElectronicaDetalleRespuesta,
    dependencies=[GestionaFactura],
)
def consultar_estado(id_factura: int, sesion: SesionBD):
    """Le pregunta al proveedor como va el documento."""
    return servicio.consultar_estado(sesion, id_factura)


@router.post(
    "/{id_factura}/anular",
    response_model=FacturaElectronicaDetalleRespuesta,
    dependencies=[GestionaFactura],
)
def anular(
    id_factura: int,
    sesion: SesionBD,
    motivo: str = Query("", max_length=300),
):
    """Baja logica: el documento queda ANULADO, no se borra."""
    return servicio.anular_factura(sesion, id_factura, motivo)
