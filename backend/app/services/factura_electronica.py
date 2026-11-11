"""Servicio de facturacion electronica (DIAN).

FLUJO
-----
    venta  ->  generar  ->  BORRADOR   (calcula CUFE, arma XML, numera)
                        ->  firmar    ->  FIRMADA
                        ->  enviar    ->  ENVIADA -> ACEPTADA / RECHAZADA
                        ->  anular    ->  ANULADA   (baja logica)

DECISION SOBRE EL IVA (importante)
----------------------------------
El resto del sistema (pedido, venta) maneja **precios con IVA incluido**: el
cliente paga exactamente `precio_unitario * cantidad`, y `venta.total_pagado`
es esa suma. Por eso aqui el IVA **no se suma encima**: se DESCOMPONE.

    valor con IVA = 119.000
    base          = 119.000 / 1.19 = 100.000
    IVA (19 %)    =  19.000

Asi `factura_electronica.total_factura` SIEMPRE cuadra con
`venta.total_pagado`. Si se sumara el IVA encima, la factura diria que el
cliente debe mas de lo que pago: dos verdades distintas sobre el mismo dinero.

El porcentaje se configura con `DIAN_IVA_PORCENTAJE` (por defecto 19).

NUMERACION
----------
La DIAN autoriza un rango (por ejemplo 1 a 5000) con un prefijo (DT). El
consecutivo sale de la resolucion vigente y se guarda incrementado en la
misma transaccion, para no repetir numeros. Si el rango se agota, no se
factura: se avisa para que se pida una resolucion nueva.
"""

import json
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import configuracion
from app.core.exceptions import Conflicto, NoEncontrado, ReglaNegocio
from app.models.factura_electronica import FacturaElectronica
from app.models.resolucion_facturacion import ResolucionFacturacion
from app.repositories.factura_electronica import (
    FacturaElectronicaRepositorio,
    ResolucionRepositorio,
)
from app.repositories.usuario import UsuarioRepositorio
from app.repositories.venta import VentaRepositorio
from app.schemas.factura_electronica import (
    GenerarFacturaEntrada,
    ResolucionActualizar,
    ResolucionCrear,
)
from app.services.dian import obtener_proveedor
from app.services.dian.cufe import calcular_cufe, construir_cadena_cufe
from app.services.dian.xml_ubl import generar_xml

CENTAVO = Decimal("0.01")

# Estados del documento
BORRADOR = "BORRADOR"
FIRMADA = "FIRMADA"
ENVIADA = "ENVIADA"
ACEPTADA = "ACEPTADA"
RECHAZADA = "RECHAZADA"
ANULADA = "ANULADA"

ESTADOS_VALIDOS = {BORRADOR, FIRMADA, ENVIADA, ACEPTADA, RECHAZADA, ANULADA}


# --- utilidades ---------------------------------------------------------------

def _centavos(valor: Decimal | float | int | None) -> Decimal:
    if valor is None:
        valor = Decimal("0")
    return Decimal(str(valor)).quantize(CENTAVO, rounding=ROUND_HALF_UP)


def _porcentaje_iva() -> Decimal:
    try:
        return Decimal(str(configuracion.dian_iva_porcentaje))
    except Exception:
        return Decimal("19")


def _factor_iva() -> Decimal:
    return Decimal("1") + (_porcentaje_iva() / Decimal("100"))


def _ahora() -> datetime:
    return datetime.now()


def _datos_emisor() -> dict:
    """Los datos de la empresa, desde la configuracion (.env)."""
    return {
        "nit_emisor": configuracion.dian_nit_emisor,
        "dv_emisor": configuracion.dian_dv_emisor,
        "razon_social_emisor": configuracion.dian_razon_social,
        "nombre_comercial_emisor": configuracion.dian_nombre_comercial,
        "direccion_emisor": configuracion.dian_direccion,
        "ciudad_emisor": configuracion.dian_ciudad,
        "departamento_emisor": configuracion.dian_departamento,
        "telefono_emisor": configuracion.dian_telefono,
        "correo_emisor": configuracion.dian_correo,
        "regimen_emisor": configuracion.dian_regimen,
        "responsabilidades_emisor": configuracion.dian_responsabilidades,
        "actividad_economica_emisor": configuracion.dian_actividad_economica,
        "software_id": configuracion.dian_software_id,
        "software_security_code": configuracion.dian_software_security_code,
        "ambiente": configuracion.dian_ambiente or "2",
    }


def _url_qr(cufe: str, ambiente: str) -> str:
    """El QR que va impreso en la factura (lo exige la DIAN)."""
    if str(ambiente) == "1":
        base = "https://catalogo-vpfe.dian.gov.co/document/searchqr"
    else:
        base = "https://catalogo-vpfe-hab.dian.gov.co/document/searchqr"
    return f"{base}?documentkey={cufe}"


def _evento(
    sesion: Session, id_factura: int, tipo: str, estado: str, mensaje: str,
    payload: Optional[dict] = None,
) -> None:
    """Deja constancia en la bitacora. Es lo que permite auditar despues."""
    FacturaElectronicaRepositorio(sesion).crear_evento(
        {
            "id_factura_fk": id_factura,
            "fecha": _ahora(),
            "tipo": tipo,
            "estado": estado,
            "mensaje": mensaje[:500],
            "payload": json.dumps(payload, default=str) if payload else None,
        }
    )


# --- RESOLUCIONES -------------------------------------------------------------

def listar_resoluciones(
    sesion: Session, saltar: int = 0, limite: int = 20, solo_vigentes: bool = False
) -> tuple[list[ResolucionFacturacion], int]:
    return ResolucionRepositorio(sesion).listar(saltar, limite, solo_vigentes)


def obtener_resolucion(sesion: Session, id_resolucion: int) -> ResolucionFacturacion:
    resolucion = ResolucionRepositorio(sesion).buscar_por_id(id_resolucion)
    if resolucion is None:
        raise NoEncontrado(f"La resolucion {id_resolucion} no existe")
    return resolucion


def crear_resolucion(sesion: Session, datos: ResolucionCrear) -> ResolucionFacturacion:
    """Da de alta una resolucion y la deja como la vigente de su tipo.

    Al crearla, las demas del mismo tipo quedan como NO vigentes: la DIAN
    solo permite numerar con una resolucion a la vez.
    """
    repo = ResolucionRepositorio(sesion)

    for otra in repo.listar(saltar=0, limite=1000)[0]:
        if otra.tipo_documento == datos.tipo_documento and otra.vigente:
            otra.vigente = False

    valores = datos.model_dump()
    # El consecutivo arranca en el primer numero del rango (o en 0).
    valores["consecutivo_actual"] = (valores.get("rango_desde") or 1) - 1
    valores["vigente"] = True

    resolucion = repo.crear(valores)
    sesion.commit()
    sesion.refresh(resolucion)
    return resolucion


def actualizar_resolucion(
    sesion: Session, id_resolucion: int, datos: ResolucionActualizar
) -> ResolucionFacturacion:
    resolucion = obtener_resolucion(sesion, id_resolucion)

    cambios = datos.model_dump(exclude_unset=True)

    desde = cambios.get("rango_desde", resolucion.rango_desde)
    hasta = cambios.get("rango_hasta", resolucion.rango_hasta)
    if desde is not None and hasta is not None and hasta < desde:
        raise ReglaNegocio("rango_hasta no puede ser menor que rango_desde")

    for campo, valor in cambios.items():
        setattr(resolucion, campo, valor)

    sesion.commit()
    sesion.refresh(resolucion)
    return resolucion


def marcar_resolucion_vigente(
    sesion: Session, id_resolucion: int, vigente: bool = True
) -> ResolucionFacturacion:
    """Deja esta resolucion como la unica vigente de su tipo."""
    resolucion = obtener_resolucion(sesion, id_resolucion)
    repo = ResolucionRepositorio(sesion)

    if vigente:
        for otra in repo.listar(saltar=0, limite=1000)[0]:
            if (
                otra.id_resolucion != resolucion.id_resolucion
                and otra.tipo_documento == resolucion.tipo_documento
            ):
                otra.vigente = False

    resolucion.vigente = vigente
    sesion.commit()
    sesion.refresh(resolucion)
    return resolucion


def _resolucion_vigente(sesion: Session) -> ResolucionFacturacion:
    resolucion = ResolucionRepositorio(sesion).buscar_vigente()
    if resolucion is None:
        raise ReglaNegocio(
            "No hay una resolucion de facturacion vigente. "
            "Registre la resolucion de la DIAN antes de generar facturas"
        )
    return resolucion


# --- GENERACION ---------------------------------------------------------------

def _armar_lineas(sesion: Session, id_venta: int) -> list[dict]:
    """Convierte las lineas de la venta en lineas de la factura electronica.

    El IVA se DESCOMPONE del precio final (ver el docstring del modulo).
    """
    repo_venta = VentaRepositorio(sesion)
    repo_producto = None
    factor = _factor_iva()
    porcentaje = _porcentaje_iva()
    lineas: list[dict] = []

    for numero, detalle in enumerate(repo_venta.listar_detalles(id_venta), start=1):
        cantidad = Decimal(str(detalle.cantidad or 0))
        # Lo que el cliente realmente pago por esta linea (con IVA dentro).
        total_con_iva = _centavos(Decimal(str(detalle.precio_unitario or 0)) * cantidad)

        base = _centavos(total_con_iva / factor)
        iva = _centavos(total_con_iva - base)

        # Descuento informativo (tambien en base, sin IVA).
        lista = detalle.precio_lista
        descuento = Decimal("0")
        if lista is not None and Decimal(str(lista)) > Decimal(str(detalle.precio_unitario or 0)):
            descuento_con_iva = _centavos(
                (Decimal(str(lista)) - Decimal(str(detalle.precio_unitario or 0)))
                * cantidad
            )
            descuento = _centavos(descuento_con_iva / factor)

        # Nombre del producto para el XML ("Pantalon - Talla M - Azul").
        if repo_producto is None:
            from app.repositories.producto import ProductoRepositorio

            repo_producto = ProductoRepositorio(sesion)

        producto = repo_producto.buscar_por_id(detalle.id_producto_fk)
        if producto is not None:
            partes = [producto.nombre or f"Producto {producto.id_producto}"]
            if producto.talla:
                partes.append(f"Talla {producto.talla}")
            if producto.color:
                partes.append(producto.color)
            descripcion = " - ".join(partes)
        else:
            descripcion = f"Producto {detalle.id_producto_fk}"

        precio_unitario_base = (
            _centavos(base / cantidad) if cantidad > 0 else Decimal("0")
        )

        lineas.append(
            {
                "numero_linea": numero,
                "codigo_producto": str(detalle.id_producto_fk),
                "descripcion": descripcion[:300],
                "cantidad": cantidad,
                "unidad_medida": "94",
                "precio_unitario": precio_unitario_base,
                "descuento": descuento,
                "iva_porcentaje": porcentaje,
                "iva_valor": iva,
                "total_linea": base,
            }
        )

    return lineas


def _siguiente_numero(resolucion: ResolucionFacturacion) -> tuple[int, str]:
    """Consecutivo siguiente y numero completo (prefijo + ceros + numero)."""
    actual = resolucion.consecutivo_actual
    desde = resolucion.rango_desde or 1

    siguiente = (actual or 0) + 1
    if siguiente < desde:
        siguiente = desde

    if resolucion.rango_hasta is not None and siguiente > resolucion.rango_hasta:
        raise ReglaNegocio(
            f"La resolucion {resolucion.numero_resolucion} agoto su rango "
            f"({resolucion.rango_desde} a {resolucion.rango_hasta}). "
            "Registre una resolucion nueva para seguir facturando"
        )

    prefijo = resolucion.prefijo or ""
    # Se rellena con ceros al ancho del rango (rango 1-5000 -> 4 digitos).
    ancho = len(str(resolucion.rango_hasta or siguiente)) if resolucion.rango_hasta else 0
    numero = f"{prefijo}{str(siguiente).zfill(ancho)}"
    return siguiente, numero


def generar_factura(sesion: Session, datos: GenerarFacturaEntrada) -> dict:
    """Crea el documento en BORRADOR a partir de una venta."""
    repo_venta = VentaRepositorio(sesion)
    venta = repo_venta.buscar_por_id(datos.id_venta)
    if venta is None:
        raise NoEncontrado(f"La venta {datos.id_venta} no existe")

    if (venta.estado or "").lower() == "anulada":
        raise Conflicto("No se puede facturar una venta anulada")

    repo = FacturaElectronicaRepositorio(sesion)
    if repo.buscar_por_venta(venta.id_venta) is not None:
        raise Conflicto(
            f"La venta {venta.id_venta} ya tiene una factura electronica"
        )

    lineas = _armar_lineas(sesion, venta.id_venta)
    if not lineas:
        raise ReglaNegocio(
            f"La venta {venta.id_venta} no tiene lineas: no se puede facturar"
        )

    resolucion = _resolucion_vigente(sesion)
    consecutivo, numero = _siguiente_numero(resolucion)

    valor_bruto = _centavos(sum((l["total_linea"] for l in lineas), Decimal("0")))
    total_iva = _centavos(sum((l["iva_valor"] for l in lineas), Decimal("0")))
    descuento_total = _centavos(sum((l["descuento"] for l in lineas), Decimal("0")))
    total_factura = _centavos(valor_bruto + total_iva)

    fecha = _ahora()
    emisor = _datos_emisor()

    # --- datos del adquiriente --------------------------------------------
    cliente = (
        UsuarioRepositorio(sesion).buscar_por_id(venta.id_usuario_fk)
        if venta.id_usuario_fk
        else None
    )
    nit_adquirente = datos.nit_adquirente or (
        (cliente.documento if cliente else None) or ""
    )
    razon_social = datos.razon_social_adquirente or (
        (cliente.nombre if cliente else None) or "Consumidor final"
    )

    # --- CUFE --------------------------------------------------------------
    cadena = construir_cadena_cufe(
        numero_factura=numero,
        fecha_emision=fecha,
        valor_base=valor_bruto,
        total_iva=total_iva,
        total_factura=total_factura,
        nit_emisor=emisor["nit_emisor"],
        documento_adquirente=nit_adquirente,
        clave_tecnica=resolucion.clave_tecnica or "",
        ambiente=emisor["ambiente"],
    )
    cufe = calcular_cufe(cadena)
    qr = _url_qr(cufe, emisor["ambiente"])

    # --- documento ---------------------------------------------------------
    valores = {
        "id_venta_fk": venta.id_venta,
        "id_pedido_fk": venta.id_pedido_fk,
        "id_cliente_fk": venta.id_usuario_fk,
        "tipo_documento": resolucion.tipo_documento or "01",
        "numero_factura": numero,
        "prefijo": resolucion.prefijo,
        "consecutivo": consecutivo,
        "fecha_emision": fecha,
        "estado": BORRADOR,
        "cufe": cufe,
        "cadena_cufe": cadena,
        "valor_bruto": valor_bruto,
        "descuento_total": descuento_total,
        "total_iva": total_iva,
        "total_impuestos": total_iva,
        "total_factura": total_factura,
        "moneda": "COP",
        "forma_pago": datos.forma_pago,
        "medio_pago": datos.medio_pago,
        # adquiriente
        "tipo_doc_adquirente": datos.tipo_doc_adquirente or "13",
        "nit_adquirente": nit_adquirente or None,
        "dv_adquirente": datos.dv_adquirente,
        "razon_social_adquirente": razon_social,
        "correo_adquirente": datos.correo_adquirente
        or (cliente.correo if cliente else None),
        "direccion_adquirente": datos.direccion_adquirente
        or (cliente.direccion if cliente else None),
        "telefono_adquirente": datos.telefono_adquirente
        or (cliente.telefono if cliente else None),
        "ciudad_adquirente": datos.ciudad_adquirente or emisor["ciudad_emisor"],
        # resolucion
        "clave_tecnica": resolucion.clave_tecnica,
        "resolucion_numero": resolucion.numero_resolucion,
        "resolucion_desde": resolucion.rango_desde,
        "resolucion_hasta": resolucion.rango_hasta,
        "resolucion_vigencia_desde": resolucion.vigencia_desde,
        "resolucion_vigencia_hasta": resolucion.vigencia_hasta,
        # DIAN
        "qr_url": qr,
        "firmado": False,
        "estado_dian": None,
        "mensaje_dian": None,
        "intentos": 0,
        "simulado": True,
        "creado_en": fecha,
        "actualizado_en": fecha,
        **emisor,
    }

    documento = {**valores}
    documento["xml"] = generar_xml(documento, lineas)
    valores["xml"] = documento["xml"]

    factura = repo.crear(valores)

    for linea in lineas:
        repo.crear_linea({**linea, "id_factura_fk": factura.id_factura})

    # Se consume el consecutivo en la misma transaccion.
    resolucion.consecutivo_actual = consecutivo

    _evento(
        sesion,
        factura.id_factura,
        tipo="GENERACION",
        estado="GENERADA",
        mensaje=f"Factura {numero} generada. CUFE: {cufe}",
        payload={"cufe": cufe, "total": str(total_factura), "simulado": True},
    )

    sesion.commit()
    sesion.refresh(factura)
    return armar_detalle(sesion, factura)


# --- FIRMA Y ENVIO ------------------------------------------------------------

def _buscar(sesion: Session, id_factura: int) -> FacturaElectronica:
    factura = FacturaElectronicaRepositorio(sesion).buscar_por_id(id_factura)
    if factura is None:
        raise NoEncontrado(f"La factura electronica {id_factura} no existe")
    return factura


def firmar_factura(sesion: Session, id_factura: int) -> dict:
    """Marca el documento como firmado.

    En el modo simulado no hay certificado digital: se marca y se deja
    constancia en la bitacora de que la firma es simulada.
    """
    factura = _buscar(sesion, id_factura)

    if factura.estado == ANULADA:
        raise Conflicto("No se puede firmar una factura anulada")
    if factura.firmado:
        raise Conflicto("La factura ya estaba firmada")
    if factura.estado not in {BORRADOR, RECHAZADA}:
        raise Conflicto(
            f"Solo se firma una factura en estado {BORRADOR} o {RECHAZADA} "
            f"(esta en {factura.estado})"
        )

    factura.firmado = True
    factura.estado = FIRMADA
    factura.actualizado_en = _ahora()

    _evento(
        sesion,
        factura.id_factura,
        tipo="FIRMA",
        estado="FIRMADA",
        mensaje=(
            "Documento marcado como firmado en MODO SIMULACION "
            "(sin certificado digital)."
        ),
        payload={"simulado": True},
    )

    sesion.commit()
    sesion.refresh(factura)
    return armar_detalle(sesion, factura)


def enviar_factura(
    sesion: Session, id_factura: int, forzar_reenvio: bool = False
) -> dict:
    """Manda el documento al proveedor (hoy, el simulador) y guarda la respuesta."""
    factura = _buscar(sesion, id_factura)

    if factura.estado == ANULADA:
        raise Conflicto("No se puede enviar una factura anulada")
    if not factura.firmado:
        raise ReglaNegocio("Primero hay que firmar la factura antes de enviarla")
    if factura.estado == ACEPTADA and not forzar_reenvio:
        raise Conflicto(
            "La factura ya fue aceptada. Use forzar_reenvio para mandarla otra vez"
        )

    proveedor = obtener_proveedor()
    lineas = FacturaElectronicaRepositorio(sesion).listar_lineas(factura.id_factura)

    documento = {
        "numero_factura": factura.numero_factura,
        "cufe": factura.cufe,
        "xml": factura.xml,
        "total_factura": factura.total_factura,
        "valor_bruto": factura.valor_bruto,
        "total_iva": factura.total_iva,
        "nit_emisor": factura.nit_emisor,
        "nit_adquirente": factura.nit_adquirente,
        "fecha_emision": factura.fecha_emision,
        "lineas": len(lineas),
    }

    factura.fecha_envio = _ahora()
    factura.intentos = (factura.intentos or 0) + 1
    factura.estado = ENVIADA

    _evento(
        sesion,
        factura.id_factura,
        tipo="ENVIO",
        estado="ENVIADA",
        mensaje=f"Envio #{factura.intentos} al proveedor '{proveedor.nombre}'",
        payload={"proveedor": proveedor.nombre, "simulado": proveedor.simulado},
    )

    try:
        respuesta = proveedor.enviar(documento)
    except Exception as error:  # el proveedor real puede fallar por red
        factura.estado = RECHAZADA
        factura.estado_dian = "ERROR_ENVIO"
        factura.mensaje_dian = f"Fallo el envio: {type(error).__name__}"
        factura.ultimo_error = str(error)[:2000]
        factura.fecha_respuesta = _ahora()
        factura.actualizado_en = _ahora()

        _evento(
            sesion,
            factura.id_factura,
            tipo="RESPUESTA",
            estado="ERROR_ENVIO",
            mensaje=f"No se pudo enviar: {type(error).__name__}",
        )

        sesion.commit()
        sesion.refresh(factura)
        return armar_detalle(sesion, factura)

    factura.estado_dian = respuesta.estado
    factura.mensaje_dian = respuesta.mensaje
    factura.track_id = respuesta.track_id
    factura.fecha_respuesta = _ahora()
    factura.actualizado_en = _ahora()
    factura.ultimo_error = None
    factura.estado = ACEPTADA if respuesta.aceptada else RECHAZADA
    factura.simulado = proveedor.simulado

    _evento(
        sesion,
        factura.id_factura,
        tipo="RESPUESTA",
        estado=respuesta.estado,
        mensaje=respuesta.mensaje,
        payload={"trackId": respuesta.track_id, "simulado": proveedor.simulado},
    )

    sesion.commit()
    sesion.refresh(factura)
    return armar_detalle(sesion, factura)


def consultar_estado(sesion: Session, id_factura: int) -> dict:
    """Le pregunta al proveedor como va el documento y actualiza el estado."""
    factura = _buscar(sesion, id_factura)

    if not factura.track_id:
        raise ReglaNegocio("La factura todavia no tiene un envio registrado")

    proveedor = obtener_proveedor()
    respuesta = proveedor.consultar_estado(factura.track_id)

    factura.estado_dian = respuesta.estado
    factura.mensaje_dian = respuesta.mensaje
    factura.fecha_respuesta = _ahora()
    factura.actualizado_en = _ahora()
    if respuesta.aceptada:
        factura.estado = ACEPTADA
    elif factura.estado != ANULADA:
        factura.estado = RECHAZADA

    _evento(
        sesion,
        factura.id_factura,
        tipo="CONSULTA",
        estado=respuesta.estado,
        mensaje=respuesta.mensaje,
        payload={"trackId": factura.track_id},
    )

    sesion.commit()
    sesion.refresh(factura)
    return armar_detalle(sesion, factura)


def anular_factura(sesion: Session, id_factura: int, motivo: str = "") -> dict:
    """Baja logica. El documento NO se borra: queda en ANULADA."""
    factura = _buscar(sesion, id_factura)

    if factura.estado == ANULADA:
        raise Conflicto("La factura ya estaba anulada")

    factura.estado = ANULADA
    factura.actualizado_en = _ahora()

    _evento(
        sesion,
        factura.id_factura,
        tipo="ANULACION",
        estado=ANULADA,
        mensaje=motivo or "Factura anulada por el usuario",
    )

    sesion.commit()
    sesion.refresh(factura)
    return armar_detalle(sesion, factura)


# --- CONSULTAS ----------------------------------------------------------------

def _respuesta(factura: FacturaElectronica) -> dict:
    """Pasa el modelo a dict con los Decimal convertidos (los schemas validan)."""
    campos = [
        "id_factura", "id_venta_fk", "id_pedido_fk", "id_cliente_fk",
        "tipo_documento", "numero_factura", "prefijo", "consecutivo",
        "fecha_emision", "estado", "cufe", "valor_bruto", "descuento_total",
        "total_iva", "total_impuestos", "total_factura", "moneda",
        "nit_emisor", "razon_social_emisor", "nit_adquirente",
        "razon_social_adquirente", "estado_dian", "mensaje_dian", "track_id",
        "fecha_envio", "fecha_respuesta", "intentos", "firmado", "simulado",
        "creado_en",
    ]
    return {campo: getattr(factura, campo, None) for campo in campos}


def armar_detalle(sesion: Session, factura: FacturaElectronica) -> dict:
    """Documento + lineas + eventos."""
    repo = FacturaElectronicaRepositorio(sesion)
    datos = _respuesta(factura)
    datos["lineas"] = repo.listar_lineas(factura.id_factura)
    datos["eventos"] = repo.listar_eventos(factura.id_factura)
    return datos


def listar_facturas(
    sesion: Session,
    saltar: int = 0,
    limite: int = 20,
    estado: Optional[str] = None,
    estado_dian: Optional[str] = None,
    id_venta: Optional[int] = None,
    numero: Optional[str] = None,
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
) -> tuple[list[dict], int]:
    facturas, total = FacturaElectronicaRepositorio(sesion).listar(
        saltar=saltar,
        limite=limite,
        estado=estado,
        estado_dian=estado_dian,
        id_venta=id_venta,
        numero=numero,
        desde=desde,
        hasta=hasta,
    )
    return [_respuesta(f) for f in facturas], total


def obtener_factura(sesion: Session, id_factura: int) -> dict:
    return armar_detalle(sesion, _buscar(sesion, id_factura))


def obtener_xml(sesion: Session, id_factura: int) -> str:
    factura = _buscar(sesion, id_factura)
    if not factura.xml:
        raise NoEncontrado(
            f"La factura {id_factura} no tiene XML generado"
        )
    return factura.xml


def listar_eventos(sesion: Session, id_factura: int) -> list:
    _buscar(sesion, id_factura)  # 404 si no existe
    return FacturaElectronicaRepositorio(sesion).listar_eventos(id_factura)
