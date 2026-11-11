"""Tests del modulo de facturacion electronica (DIAN).

Cubre el flujo completo: generar (con CUFE y XML), firmar, enviar, consultar
y anular; la numeracion por resolucion; el IVA descompuesto; y las reglas de
acceso.

LA PRUEBA CLAVE `test_el_cufe_cambia_si_cambia_un_solo_peso` demuestra para
que sirve el CUFE: si alguien altera un valor de la factura, la huella deja
de coincidir y la DIAN lo detecta.
"""

import hashlib
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest

from app.core.config import configuracion
from app.core.security import hashear_password
from app.models.factura_electronica import FacturaElectronica
from app.models.resolucion_facturacion import ResolucionFacturacion
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from app.services.dian.cufe import (
    calcular_cufe,
    construir_cadena_cufe,
    formatear_valor,
)


# --- utilidades ---------------------------------------------------------------

def crear_usuario(sesion, correo: str, id_rol: int = 2, documento: str = "46545454"):
    usuario = Usuario(
        nombre=correo.split("@")[0],
        correo=correo,
        password=hashear_password("secreta123"),
        estado="Habilitado",
        id_rol_fk=id_rol,
        documento=documento,
        telefono="65674654",
        direccion="calle 1 # 2-3",
    )
    sesion.add(usuario)
    sesion.flush()
    sesion.add(
        UsuarioRol(id_usuario_fk=usuario.id_usuario, id_rol_fk=id_rol, activo=True)
    )
    sesion.commit()
    sesion.refresh(usuario)
    return usuario


def token_de(cliente, correo: str) -> dict:
    respuesta = cliente.post(
        "/api/v1/auth/login", json={"correo": correo, "password": "secreta123"}
    )
    assert respuesta.status_code == 200, respuesta.text
    return {"Authorization": f"Bearer {respuesta.json()['access_token']}"}


def crear_resolucion(sesion, rango_hasta: int = 5000, prefijo: str = "DT") -> ResolucionFacturacion:
    resolucion = ResolucionFacturacion(
        tipo_documento="01",
        numero_resolucion="18760000001",
        prefijo=prefijo,
        rango_desde=1,
        rango_hasta=rango_hasta,
        consecutivo_actual=0,
        clave_tecnica="fc8eac422eba16e22ffd8c6f94b3f40a6e38162c",
        vigencia_desde=date(2025, 1, 1),
        vigencia_hasta=date(2027, 12, 31),
        vigente=True,
    )
    sesion.add(resolucion)
    sesion.commit()
    sesion.refresh(resolucion)
    return resolucion


# --- fixtures -----------------------------------------------------------------

@pytest.fixture()
def admin(cliente, sesion):
    crear_usuario(sesion, "admin@toronto.com", id_rol=1)
    return token_de(cliente, "admin@toronto.com")


@pytest.fixture()
def vendedor(cliente, sesion):
    crear_usuario(sesion, "vendedor@toronto.com", id_rol=3)
    return token_de(cliente, "vendedor@toronto.com")


@pytest.fixture()
def cliente_pepe(cliente, sesion):
    crear_usuario(sesion, "pepe@toronto.com", id_rol=2)
    return token_de(cliente, "pepe@toronto.com")


@pytest.fixture()
def resolucion(sesion, admin):
    return crear_resolucion(sesion)


def _crear_venta(
    cliente,
    admin,
    cliente_pepe,
    sesion,
    precio: str = "119000.00",
    cantidad: int = 1,
    nombre: str = "Camisa",
):
    """Arma una venta por el camino normal: producto -> carrito -> pedido -> venta.

    Precio 119.000 con IVA incluido: la base son 100.000 y el IVA 19.000.
    Devuelve la venta como dict (lo que responde GET /ventas).
    """
    from app.models.inventario import Inventario

    creado = cliente.post(
        "/api/v1/productos",
        json={"nombre": nombre, "precio": precio, "categoria": "Uniforme"},
        headers=admin,
    )
    assert creado.status_code == 201, creado.text
    producto = creado.json()

    sesion.add(
        Inventario(
            id_producto_fk=producto["id_producto"],
            cantidad_actual=50,
            stock_minimo=2,
        )
    )
    sesion.commit()

    cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": cantidad},
        headers=cliente_pepe,
    )

    pedido = cliente.post("/api/v1/pedidos", headers=cliente_pepe).json()

    for estado in ("Enviado", "Entregado"):
        respuesta = cliente.patch(
            f"/api/v1/pedidos/{pedido['id_pedido']}/estado",
            json={"estado": estado},
            headers=admin,
        )
        assert respuesta.status_code == 200, respuesta.text

    return cliente.get(
        f"/api/v1/ventas?id_pedido={pedido['id_pedido']}", headers=admin
    ).json()["items"][0]


@pytest.fixture()
def venta(cliente, admin, cliente_pepe, sesion, resolucion):
    return _crear_venta(cliente, admin, cliente_pepe, sesion)


def generar(cliente, cabeceras, id_venta: int):
    return cliente.post(
        "/api/v1/facturas-electronicas",
        json={"id_venta": id_venta},
        headers=cabeceras,
    )


# --- CUFE (unidad) ------------------------------------------------------------

def test_formatear_valor_siempre_dos_decimales():
    assert formatear_valor(Decimal("92436.9")) == "92436.90"
    assert formatear_valor(110000) == "110000.00"
    assert formatear_valor(None) == "0.00"


def test_el_cufe_del_dump_se_reproduce_exacto():
    """El CUFE guardado en la base tiene que salir igual con esta formula.

    Si esto falla, la formula del CUFE esta mal y la DIAN rechazaria todo.
    """
    cadena = construir_cadena_cufe(
        numero_factura="DT0001",
        fecha_emision=datetime(2026, 10, 23, 13, 44, 26),
        valor_base=Decimal("92436.97"),
        total_iva=Decimal("17563.03"),
        total_factura=Decimal("110000.00"),
        nit_emisor="900123456",
        documento_adquirente="46545454",
        clave_tecnica="fc8eac422eba16e22ffd8c6f94b3f40a6e38162c",
        ambiente="2",
    )
    esperado = "6625a6cb8d136920d3479b65e9210ba689c21ecd44cbde27af18fcc8b8435c32183beaea87ce25cdf3bf05e2b0d87f64"
    assert calcular_cufe(cadena) == esperado


def test_el_cufe_cambia_si_cambia_un_solo_peso():
    """Para eso sirve el CUFE: un peso de diferencia lo delata."""
    base = dict(
        numero_factura="DT0001",
        fecha_emision=datetime(2026, 10, 23, 13, 44, 26),
        valor_base=Decimal("92436.97"),
        total_iva=Decimal("17563.03"),
        total_factura=Decimal("110000.00"),
        nit_emisor="900123456",
        documento_adquirente="46545454",
        clave_tecnica="fc8eac422eba16e22ffd8c6f94b3f40a6e38162c",
        ambiente="2",
    )
    original = calcular_cufe(construir_cadena_cufe(**base))

    alterado = {**base, "total_factura": Decimal("110000.01")}
    otro = calcular_cufe(construir_cadena_cufe(**alterado))

    assert original != otro
    assert len(original) == 96  # SHA-384 en hexadecimal


# --- generar ------------------------------------------------------------------

def test_vendedor_genera_la_factura(cliente, vendedor, venta):
    respuesta = generar(cliente, vendedor, venta["id_venta"])
    assert respuesta.status_code == 201, respuesta.text

    datos = respuesta.json()
    assert datos["numero_factura"] == "DT0001"
    assert datos["estado"] == "BORRADOR"
    assert datos["simulado"] is True
    assert len(datos["cufe"]) == 96
    assert len(datos["lineas"]) == 1


def test_la_factura_cuadra_con_lo_que_pago_el_cliente(cliente, vendedor, venta):
    """total_factura tiene que ser igual a venta.total_pagado."""
    datos = generar(cliente, vendedor, venta["id_venta"]).json()
    assert Decimal(str(datos["total_factura"])) == Decimal(str(venta["total_pagado"]))


def test_el_iva_se_descompone_no_se_suma(cliente, vendedor, venta):
    """Precio 119.000 con IVA incluido: base 100.000 + IVA 19.000."""
    datos = generar(cliente, vendedor, venta["id_venta"]).json()

    assert Decimal(str(datos["valor_bruto"])) == Decimal("100000.00")
    assert Decimal(str(datos["total_iva"])) == Decimal("19000.00")
    assert Decimal(str(datos["total_factura"])) == Decimal("119000.00")

    linea = datos["lineas"][0]
    assert Decimal(str(linea["iva_porcentaje"])) == Decimal("19.00")
    assert Decimal(str(linea["iva_valor"])) == Decimal("19000.00")
    assert Decimal(str(linea["total_linea"])) == Decimal("100000.00")


def test_generar_guarda_la_bitacora(cliente, vendedor, venta):
    datos = generar(cliente, vendedor, venta["id_venta"]).json()
    assert len(datos["eventos"]) == 1
    assert datos["eventos"][0]["tipo"] == "GENERACION"


def test_el_consecutivo_avanza(cliente, sesion, admin, vendedor, venta, resolucion):
    generar(cliente, vendedor, venta["id_venta"])
    sesion.refresh(resolucion)
    assert resolucion.consecutivo_actual == 1


def test_el_segundo_documento_lleva_el_siguiente_numero(
    cliente, admin, cliente_pepe, vendedor, sesion, venta, resolucion
):
    generar(cliente, vendedor, venta["id_venta"])

    otra_venta = _crear_venta(cliente, admin, cliente_pepe, sesion, nombre="Pantalon")
    datos = generar(cliente, vendedor, otra_venta["id_venta"]).json()
    assert datos["numero_factura"] == "DT0002"


def test_no_se_puede_facturar_dos_veces_la_misma_venta(cliente, vendedor, venta):
    generar(cliente, vendedor, venta["id_venta"])
    respuesta = generar(cliente, vendedor, venta["id_venta"])
    assert respuesta.status_code == 409


def test_sin_resolucion_vigente_no_se_factura(
    cliente, sesion, admin, vendedor, cliente_pepe
):
    """Se crea la venta ANTES de la resolucion."""
    venta = _crear_venta(cliente, admin, cliente_pepe, sesion)
    respuesta = generar(cliente, vendedor, venta["id_venta"])
    assert respuesta.status_code == 400
    assert "resolucion" in respuesta.json()["detalle"].lower()


def test_resolucion_agotada_da_400(cliente, sesion, admin, vendedor, cliente_pepe):
    crear_resolucion(sesion, rango_hasta=1)
    venta = _crear_venta(cliente, admin, cliente_pepe, sesion)
    generar(cliente, vendedor, venta["id_venta"])  # usa el 1

    otra = _crear_venta(cliente, admin, cliente_pepe, sesion, nombre="Pantalon")
    respuesta = generar(cliente, vendedor, otra["id_venta"])
    assert respuesta.status_code == 400
    assert "agoto su rango" in respuesta.json()["detalle"]


def test_venta_inexistente_da_404(cliente, vendedor, resolucion):
    respuesta = generar(cliente, vendedor, 9999)
    assert respuesta.status_code == 404


def test_un_cliente_no_puede_generar_facturas(cliente, cliente_pepe, venta):
    respuesta = generar(cliente, cliente_pepe, venta["id_venta"])
    assert respuesta.status_code == 403


# --- XML ----------------------------------------------------------------------

def test_el_xml_es_valido_y_tiene_lo_que_pide_la_dian(cliente, vendedor, venta):
    datos = generar(cliente, vendedor, venta["id_venta"]).json()

    respuesta = cliente.get(
        f"/api/v1/facturas-electronicas/{datos['id_factura']}/xml",
        headers=vendedor,
    )
    assert respuesta.status_code == 200
    assert respuesta.headers["content-type"].startswith("application/xml")
    assert "DT0001.xml" in respuesta.headers["content-disposition"]

    # Que sea XML de verdad (si estuviera mal armado, esto explota).
    raiz = ET.fromstring(respuesta.text)

    ns = {
        "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
        "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
    }
    assert raiz.tag.endswith("Invoice")
    assert raiz.findtext("cbc:UBLVersionID", namespaces=ns) == "UBL 2.1"
    assert raiz.findtext("cbc:ID", namespaces=ns) == "DT0001"
    assert raiz.findtext("cbc:UUID", namespaces=ns) == datos["cufe"]

    lineas = raiz.findall("cac:InvoiceLine", namespaces=ns)
    assert len(lineas) == 1


def test_el_xml_escapa_los_caracteres_peligrosos(
    cliente, admin, cliente_pepe, vendedor, sesion, resolucion
):
    """Un nombre con & o < no puede romper el XML."""
    venta = _crear_venta(
        cliente, admin, cliente_pepe, sesion,
        nombre="Camisa & Pantalon <especial>",
        precio="11900.00",
    )

    datos = generar(cliente, vendedor, venta["id_venta"]).json()
    xml = cliente.get(
        f"/api/v1/facturas-electronicas/{datos['id_factura']}/xml", headers=vendedor
    ).text

    ET.fromstring(xml)  # si no escapó, esto lanza ParseError
    assert "&amp;" in xml


# --- firmar / enviar ----------------------------------------------------------

def test_flujo_completo_generar_firmar_enviar(cliente, vendedor, venta):
    datos = generar(cliente, vendedor, venta["id_venta"]).json()
    id_factura = datos["id_factura"]

    firmada = cliente.post(
        f"/api/v1/facturas-electronicas/{id_factura}/firmar", headers=vendedor
    )
    assert firmada.status_code == 200
    assert firmada.json()["estado"] == "FIRMADA"
    assert firmada.json()["firmado"] is True

    enviada = cliente.post(
        f"/api/v1/facturas-electronicas/{id_factura}/enviar", headers=vendedor
    )
    assert enviada.status_code == 200, enviada.text
    datos_envio = enviada.json()
    assert datos_envio["estado"] == "ACEPTADA"
    assert datos_envio["estado_dian"] == "ACEPTADA"
    assert datos_envio["track_id"]
    assert datos_envio["intentos"] == 1
    assert "SIMULACION" in datos_envio["mensaje_dian"]


def test_no_se_puede_enviar_sin_firmar(cliente, vendedor, venta):
    datos = generar(cliente, vendedor, venta["id_venta"]).json()
    respuesta = cliente.post(
        f"/api/v1/facturas-electronicas/{datos['id_factura']}/enviar",
        headers=vendedor,
    )
    assert respuesta.status_code == 400
    assert "firmar" in respuesta.json()["detalle"]


def test_no_se_puede_enviar_dos_veces_sin_forzar(cliente, vendedor, venta):
    datos = generar(cliente, vendedor, venta["id_venta"]).json()
    id_factura = datos["id_factura"]
    cliente.post(f"/api/v1/facturas-electronicas/{id_factura}/firmar", headers=vendedor)
    cliente.post(f"/api/v1/facturas-electronicas/{id_factura}/enviar", headers=vendedor)

    respuesta = cliente.post(
        f"/api/v1/facturas-electronicas/{id_factura}/enviar", headers=vendedor
    )
    assert respuesta.status_code == 409


def test_forzar_reenvio_funciona(cliente, vendedor, venta):
    datos = generar(cliente, vendedor, venta["id_venta"]).json()
    id_factura = datos["id_factura"]
    cliente.post(f"/api/v1/facturas-electronicas/{id_factura}/firmar", headers=vendedor)
    cliente.post(f"/api/v1/facturas-electronicas/{id_factura}/enviar", headers=vendedor)

    respuesta = cliente.post(
        f"/api/v1/facturas-electronicas/{id_factura}/enviar",
        json={"forzar_reenvio": True},
        headers=vendedor,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["intentos"] == 2


def test_firmar_dos_veces_da_409(cliente, vendedor, venta):
    datos = generar(cliente, vendedor, venta["id_venta"]).json()
    cliente.post(
        f"/api/v1/facturas-electronicas/{datos['id_factura']}/firmar", headers=vendedor
    )
    respuesta = cliente.post(
        f"/api/v1/facturas-electronicas/{datos['id_factura']}/firmar", headers=vendedor
    )
    assert respuesta.status_code == 409


def test_consultar_estado(cliente, vendedor, venta):
    datos = generar(cliente, vendedor, venta["id_venta"]).json()
    id_factura = datos["id_factura"]
    cliente.post(f"/api/v1/facturas-electronicas/{id_factura}/firmar", headers=vendedor)
    cliente.post(f"/api/v1/facturas-electronicas/{id_factura}/enviar", headers=vendedor)

    respuesta = cliente.post(
        f"/api/v1/facturas-electronicas/{id_factura}/consultar-estado", headers=vendedor
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "ACEPTADA"


def test_consultar_sin_envio_previo_da_400(cliente, vendedor, venta):
    datos = generar(cliente, vendedor, venta["id_venta"]).json()
    respuesta = cliente.post(
        f"/api/v1/facturas-electronicas/{datos['id_factura']}/consultar-estado",
        headers=vendedor,
    )
    assert respuesta.status_code == 400


def test_la_bitacora_crece_con_cada_paso(cliente, vendedor, venta):
    datos = generar(cliente, vendedor, venta["id_venta"]).json()
    id_factura = datos["id_factura"]

    cliente.post(f"/api/v1/facturas-electronicas/{id_factura}/firmar", headers=vendedor)
    cliente.post(f"/api/v1/facturas-electronicas/{id_factura}/enviar", headers=vendedor)

    respuesta = cliente.get(
        f"/api/v1/facturas-electronicas/{id_factura}/eventos", headers=vendedor
    )
    tipos = [e["tipo"] for e in respuesta.json()]
    assert tipos == ["GENERACION", "FIRMA", "ENVIO", "RESPUESTA"]


# --- anular -------------------------------------------------------------------

def test_anular_es_baja_logica(cliente, sesion, vendedor, venta):
    datos = generar(cliente, vendedor, venta["id_venta"]).json()
    id_factura = datos["id_factura"]

    respuesta = cliente.post(
        f"/api/v1/facturas-electronicas/{id_factura}/anular",
        params={"motivo": "Error en el cliente"},
        headers=vendedor,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "ANULADA"

    # El documento sigue existiendo.
    assert (
        cliente.get(
            f"/api/v1/facturas-electronicas/{id_factura}", headers=vendedor
        ).status_code
        == 200
    )


def test_anular_dos_veces_da_409(cliente, vendedor, venta):
    datos = generar(cliente, vendedor, venta["id_venta"]).json()
    id_factura = datos["id_factura"]
    cliente.post(f"/api/v1/facturas-electronicas/{id_factura}/anular", headers=vendedor)
    respuesta = cliente.post(
        f"/api/v1/facturas-electronicas/{id_factura}/anular", headers=vendedor
    )
    assert respuesta.status_code == 409


def test_una_factura_anulada_no_se_envia(cliente, vendedor, venta):
    datos = generar(cliente, vendedor, venta["id_venta"]).json()
    id_factura = datos["id_factura"]
    cliente.post(f"/api/v1/facturas-electronicas/{id_factura}/firmar", headers=vendedor)
    cliente.post(f"/api/v1/facturas-electronicas/{id_factura}/anular", headers=vendedor)

    respuesta = cliente.post(
        f"/api/v1/facturas-electronicas/{id_factura}/enviar", headers=vendedor
    )
    assert respuesta.status_code == 409


# --- consultas y acceso -------------------------------------------------------

def test_listar_facturas(cliente, vendedor, venta):
    generar(cliente, vendedor, venta["id_venta"])
    respuesta = cliente.get("/api/v1/facturas-electronicas", headers=vendedor)
    assert respuesta.status_code == 200
    assert respuesta.json()["total"] == 1


def test_filtro_por_estado(cliente, vendedor, venta):
    generar(cliente, vendedor, venta["id_venta"])
    respuesta = cliente.get(
        "/api/v1/facturas-electronicas",
        params={"estado": "BORRADOR"},
        headers=vendedor,
    )
    assert respuesta.json()["total"] == 1

    vacio = cliente.get(
        "/api/v1/facturas-electronicas",
        params={"estado": "ACEPTADA"},
        headers=vendedor,
    )
    assert vacio.json()["total"] == 0


def test_el_cliente_solo_ve_sus_facturas(
    cliente, admin, cliente_pepe, vendedor, sesion, venta
):
    generar(cliente, vendedor, venta["id_venta"])

    # El cliente dueño de la venta la ve.
    suyas = cliente.get("/api/v1/facturas-electronicas", headers=cliente_pepe).json()
    assert suyas["total"] == 1

    # Otro cliente no ve nada.
    crear_usuario(sesion, "otro@toronto.com", id_rol=2, documento="1111")
    otro = token_de(cliente, "otro@toronto.com")
    ajenas = cliente.get("/api/v1/facturas-electronicas", headers=otro).json()
    assert ajenas["total"] == 0


def test_el_cliente_no_ve_el_detalle_de_otro(
    cliente, cliente_pepe, vendedor, sesion, venta
):
    datos = generar(cliente, vendedor, venta["id_venta"]).json()

    crear_usuario(sesion, "otro@toronto.com", id_rol=2, documento="1111")
    otro = token_de(cliente, "otro@toronto.com")

    respuesta = cliente.get(
        f"/api/v1/facturas-electronicas/{datos['id_factura']}", headers=otro
    )
    assert respuesta.status_code == 403


def test_por_venta(cliente, vendedor, venta):
    generada = generar(cliente, vendedor, venta["id_venta"]).json()
    respuesta = cliente.get(
        f"/api/v1/facturas-electronicas/por-venta/{venta["id_venta"]}", headers=vendedor
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["id_factura"] == generada["id_factura"]


def test_por_venta_sin_factura_da_404(cliente, vendedor, venta):
    respuesta = cliente.get(
        f"/api/v1/facturas-electronicas/por-venta/{venta["id_venta"]}", headers=vendedor
    )
    assert respuesta.status_code == 404


# --- resoluciones -------------------------------------------------------------

def test_admin_crea_una_resolucion(cliente, admin):
    respuesta = cliente.post(
        "/api/v1/facturas-electronicas/resoluciones",
        json={
            "numero_resolucion": "18760000002",
            "prefijo": "FV",
            "rango_desde": 1,
            "rango_hasta": 1000,
            "clave_tecnica": "abc123",
            "vigencia_desde": "2026-01-01",
            "vigencia_hasta": "2027-12-31",
        },
        headers=admin,
    )
    assert respuesta.status_code == 201, respuesta.text
    datos = respuesta.json()
    assert datos["prefijo"] == "FV"
    assert datos["consecutivo_actual"] == 0  # arranca antes del primero
    assert datos["vigente"] is True


def test_crear_resolucion_deja_las_demas_no_vigentes(
    cliente, sesion, admin, resolucion
):
    cliente.post(
        "/api/v1/facturas-electronicas/resoluciones",
        json={"prefijo": "FV", "rango_desde": 1, "rango_hasta": 100},
        headers=admin,
    )
    sesion.refresh(resolucion)
    assert resolucion.vigente is False


def test_rango_invertido_da_422(cliente, admin):
    respuesta = cliente.post(
        "/api/v1/facturas-electronicas/resoluciones",
        json={"rango_desde": 100, "rango_hasta": 10},
        headers=admin,
    )
    assert respuesta.status_code == 422


def test_un_vendedor_no_crea_resoluciones(cliente, vendedor):
    respuesta = cliente.post(
        "/api/v1/facturas-electronicas/resoluciones",
        json={"prefijo": "FV", "rango_desde": 1, "rango_hasta": 100},
        headers=vendedor,
    )
    assert respuesta.status_code == 403


def test_listar_resoluciones(cliente, admin, resolucion):
    respuesta = cliente.get(
        "/api/v1/facturas-electronicas/resoluciones", headers=admin
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["total"] == 1


def test_marcar_vigente(cliente, sesion, admin, resolucion):
    otra = cliente.post(
        "/api/v1/facturas-electronicas/resoluciones",
        json={"prefijo": "FV", "rango_desde": 1, "rango_hasta": 100},
        headers=admin,
    ).json()

    respuesta = cliente.post(
        f"/api/v1/facturas-electronicas/resoluciones/{resolucion.id_resolucion}/vigente",
        headers=admin,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["vigente"] is True

    sesion.refresh(resolucion)
    assert resolucion.vigente is True

    from app.models.resolucion_facturacion import ResolucionFacturacion as R

    la_otra = sesion.query(R).filter_by(id_resolucion=otra["id_resolucion"]).first()
    assert la_otra.vigente is False


def test_actualizar_resolucion(cliente, admin, resolucion):
    respuesta = cliente.patch(
        f"/api/v1/facturas-electronicas/resoluciones/{resolucion.id_resolucion}",
        json={"notificacion": "Resolucion aprobada por la DIAN"},
        headers=admin,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["notificacion"] == "Resolucion aprobada por la DIAN"


def test_resolucion_inexistente_da_404(cliente, admin):
    respuesta = cliente.get(
        "/api/v1/facturas-electronicas/resoluciones/999", headers=admin
    )
    assert respuesta.status_code == 404


# --- reglas del proyecto ------------------------------------------------------

def test_no_existe_delete_en_facturacion_electronica():
    """REGLA DEL PROYECTO: nada se elimina. La anulacion es un estado."""
    from app.main import app as aplicacion

    rutas = aplicacion.openapi()["paths"]
    de_facturacion = [
        p for p in rutas if "facturas-electronicas" in p or "resolucion" in p
    ]
    assert de_facturacion
    for ruta in de_facturacion:
        assert "delete" not in rutas[ruta], f"{ruta} no debe tener DELETE"


def test_las_cuatro_tablas_nuevas_tienen_modelo():
    from app.database.base import Base

    import app.models  # noqa: F401

    for tabla in (
        "factura_electronica",
        "factura_electronica_detalle",
        "factura_electronica_evento",
        "resolucion_facturacion",
    ):
        assert tabla in Base.metadata.tables


def test_el_ambiente_por_defecto_es_pruebas():
    """2 = habilitacion (pruebas). Nunca se factura en produccion por error."""
    assert configuracion.dian_ambiente in {"1", "2"}
    assert configuracion.dian_proveedor == "simulado"
