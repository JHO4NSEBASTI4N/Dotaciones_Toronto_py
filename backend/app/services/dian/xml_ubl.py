"""Generacion del XML UBL 2.1 de la factura electronica.

UBL 2.1 es el formato que exige la DIAN. Aqui se arma el documento con la
estructura real (Invoice > AccountingSupplierParty, AccountingCustomerParty,
TaxTotal, LegalMonetaryTotal, InvoiceLine...), usando los nombres y las
etiquetas que pide la DIAN.

QUE FALTA PARA QUE SEA VALIDO ANTE LA DIAN
------------------------------------------
La firma digital (XAdES-EPES) dentro de <ext:UBLExtensions>. Eso necesita el
certificado digital de la empresa y una libreria de firma, por eso queda como
una extension aparte: la estructura ya trae el espacio reservado
(<ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension>).

El XML se escapa con `xml.sax.saxutils.escape`: si una descripcion trae un
"&" o un "<" (por ejemplo "Camisa & Pantalon"), sin escapar rompe el XML.

Los valores monetarios van con 2 decimales y punto. Se usa `lxml`-style manual
a proposito (sin dependencias nuevas): el proyecto solo necesita construir el
texto.
"""

from datetime import datetime
from decimal import Decimal
from xml.sax.saxutils import escape

QV_2 = Decimal("0.01")
# Codigo de unidad de medida de la DIAN: 94 = unidad.
UNIDAD_DEFECTO = "94"
PAIS = "CO"


def _v(valor: Decimal | float | int | None) -> str:
    """Valor monetario con 2 decimales y punto."""
    if valor is None:
        valor = Decimal("0")
    return f"{Decimal(str(valor)).quantize(QV_2)}"


def _q(valor: Decimal | float | int | None) -> str:
    """Cantidad con 2 decimales."""
    return _v(valor)


def _t(valor: object) -> str:
    """Texto seguro para meter dentro del XML."""
    return escape(str(valor if valor is not None else ""))


def generar_xml(documento: dict, lineas: list[dict]) -> str:
    """Devuelve el XML UBL 2.1 completo como texto.

    `documento` y `lineas` son dicts con los campos de la factura (los mismos
    que se guardan en la base).
    """
    fecha: datetime = documento.get("fecha_emision") or datetime.now()
    fecha_txt = fecha.strftime("%Y-%m-%d")
    hora_txt = fecha.strftime("%H:%M:%S-05:00")

    numero = documento.get("numero_factura", "")
    cufe = documento.get("cufe", "")
    qr = documento.get("qr_url", "")

    partes: list[str] = []

    partes.append('<?xml version="1.0" encoding="UTF-8" standalone="no"?>')
    partes.append(
        '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"'
        ' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"'
        ' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"'
        ' xmlns:ds="http://www.w3.org/2000/09/xmldsig#"'
        ' xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"'
        ' xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1"'
        ' xmlns:xades="http://uri.etsi.org/01903/v1.3.2#"'
        ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
    )

    # --- extensiones DIAN ------------------------------------------------
    partes.append("<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent>")
    partes.append("<sts:DianExtensions>")
    partes.append("<sts:InvoiceControl>")
    partes.append(
        f"<sts:InvoiceAuthorization>{_t(documento.get('resolucion_numero'))}"
        "</sts:InvoiceAuthorization>"
    )
    partes.append("<sts:AuthorizationPeriod>")
    partes.append(
        f"<cbc:StartDate>{_t(documento.get('resolucion_vigencia_desde'))}</cbc:StartDate>"
        f"<cbc:EndDate>{_t(documento.get('resolucion_vigencia_hasta'))}</cbc:EndDate>"
    )
    partes.append("</sts:AuthorizationPeriod>")
    partes.append("<sts:AuthorizedInvoices>")
    partes.append(f"<sts:Prefix>{_t(documento.get('prefijo'))}</sts:Prefix>")
    partes.append(
        f"<sts:From>{_t(documento.get('resolucion_desde'))}</sts:From>"
        f"<sts:To>{_t(documento.get('resolucion_hasta'))}</sts:To>"
    )
    partes.append("</sts:AuthorizedInvoices>")
    partes.append("</sts:InvoiceControl>")
    partes.append(
        "<sts:InvoiceSource>"
        '<cbc:IdentificationCode listAgencyID="6">CO</cbc:IdentificationCode>'
        "</sts:InvoiceSource>"
    )
    partes.append("<sts:SoftwareProvider>")
    partes.append(
        f'<sts:ProviderID schemeID="4">{_t(documento.get("nit_emisor"))}</sts:ProviderID>'
        f"<sts:SoftwareID>{_t(documento.get('software_id'))}</sts:SoftwareID>"
    )
    partes.append("</sts:SoftwareProvider>")
    partes.append(
        "<sts:SoftwareSecurityCode>"
        f"{_t(documento.get('software_security_code'))}"
        "</sts:SoftwareSecurityCode>"
    )
    partes.append(f"<sts:QRCode>{_t(qr)}</sts:QRCode>")
    partes.append("</sts:DianExtensions>")
    partes.append("</ext:ExtensionContent></ext:UBLExtension>")
    # Aqui va la firma digital (XAdES-EPES) el dia que haya certificado.
    partes.append(
        "<ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension>"
    )
    partes.append("</ext:UBLExtensions>")

    # --- cabecera --------------------------------------------------------
    partes.append("<cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>")
    partes.append("<cbc:CustomizationID>10</cbc:CustomizationID>")
    partes.append("<cbc:ProfileID>DIAN 2.1</cbc:ProfileID>")
    partes.append(
        f"<cbc:ProfileExecutionID>{_t(documento.get('ambiente'))}</cbc:ProfileExecutionID>"
    )
    partes.append(f"<cbc:ID>{_t(numero)}</cbc:ID>")
    partes.append(
        f'<cbc:UUID schemeID="2" schemeName="CUFE-SHA384">{_t(cufe)}</cbc:UUID>'
    )
    partes.append(f"<cbc:IssueDate>{fecha_txt}</cbc:IssueDate>")
    partes.append(f"<cbc:IssueTime>{hora_txt}</cbc:IssueTime>")
    partes.append(
        f"<cbc:InvoiceTypeCode>{_t(documento.get('tipo_documento') or '01')}</cbc:InvoiceTypeCode>"
    )
    partes.append(
        f"<cbc:DocumentCurrencyCode>{_t(documento.get('moneda') or 'COP')}</cbc:DocumentCurrencyCode>"
    )
    partes.append(
        f"<cbc:LineCountNumeric>{len(lineas)}</cbc:LineCountNumeric>"
    )

    # --- emisor ----------------------------------------------------------
    partes.append("<cac:AccountingSupplierParty>")
    partes.append(
        f'<cbc:AdditionalAccountID schemeAgencyID="195">{_t(documento.get("regimen_emisor"))}</cbc:AdditionalAccountID>'
    )
    partes.append("<cac:Party>")
    partes.append("<cac:PartyIdentification>")
    partes.append(
        f'<cbc:ID schemeID="31">{_t(documento.get("nit_emisor"))}</cbc:ID>'
    )
    partes.append("</cac:PartyIdentification>")
    partes.append("<cac:PartyName>")
    partes.append(
        f"<cbc:Name>{_t(documento.get('nombre_comercial_emisor'))}</cbc:Name>"
    )
    partes.append("</cac:PartyName>")
    partes.append("<cac:PartyTaxScheme>")
    partes.append(
        f"<cbc:RegistrationName>{_t(documento.get('razon_social_emisor'))}</cbc:RegistrationName>"
    )
    partes.append(
        f'<cbc:CompanyID schemeID="31">{_t(documento.get("nit_emisor"))}-'
        f"{_t(documento.get('dv_emisor'))}</cbc:CompanyID>"
    )
    if documento.get("responsabilidades_emisor"):
        partes.append(
            "<cbc:TaxLevelCode>"
            f"{_t(documento.get('responsabilidades_emisor'))}"
            "</cbc:TaxLevelCode>"
        )
    partes.append(
        '<cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme>'
    )
    partes.append("</cac:PartyTaxScheme>")
    partes.append("<cac:PartyLegalEntity>")
    partes.append(
        f"<cbc:RegistrationName>{_t(documento.get('razon_social_emisor'))}</cbc:RegistrationName>"
    )
    partes.append("<cac:Address>")
    partes.append(
        f"<cbc:CityName>{_t(documento.get('ciudad_emisor'))}</cbc:CityName>"
        f"<cbc:CountrySubentity>{_t(documento.get('departamento_emisor'))}</cbc:CountrySubentity>"
        "<cac:AddressLine>"
        f"<cbc:Line>{_t(documento.get('direccion_emisor'))}</cbc:Line>"
        "</cac:AddressLine>"
        "<cac:Country>"
        f"<cbc:IdentificationCode>{PAIS}</cbc:IdentificationCode>"
        '<cbc:Name languageID="es">Colombia</cbc:Name>'
        "</cac:Country>"
    )
    partes.append("</cac:Address>")
    partes.append("</cac:PartyLegalEntity>")
    if documento.get("telefono_emisor") or documento.get("correo_emisor"):
        partes.append("<cac:Contact>")
        partes.append(
            f"<cbc:Telephone>{_t(documento.get('telefono_emisor'))}</cbc:Telephone>"
            f"<cbc:ElectronicMail>{_t(documento.get('correo_emisor'))}</cbc:ElectronicMail>"
        )
        partes.append("</cac:Contact>")
    partes.append("</cac:Party>")
    partes.append("</cac:AccountingSupplierParty>")

    # --- adquiriente -----------------------------------------------------
    partes.append("<cac:AccountingCustomerParty>")
    partes.append("<cac:Party>")
    partes.append("<cac:PartyIdentification>")
    partes.append(
        f'<cbc:ID schemeID="{_t(documento.get("tipo_doc_adquirente") or "13")}">'
        f"{_t(documento.get('nit_adquirente'))}</cbc:ID>"
    )
    partes.append("</cac:PartyIdentification>")
    partes.append("<cac:PartyTaxScheme>")
    partes.append(
        f"<cbc:RegistrationName>{_t(documento.get('razon_social_adquirente'))}</cbc:RegistrationName>"
    )
    partes.append(
        '<cbc:TaxLevelCode>R-99-PN</cbc:TaxLevelCode>'
        '<cac:TaxScheme><cbc:ID>ZZ</cbc:ID><cbc:Name>No aplica</cbc:Name></cac:TaxScheme>'
    )
    partes.append("</cac:PartyTaxScheme>")
    partes.append("<cac:PartyLegalEntity>")
    partes.append(
        f"<cbc:RegistrationName>{_t(documento.get('razon_social_adquirente'))}</cbc:RegistrationName>"
    )
    partes.append("<cac:Address>")
    partes.append(
        f"<cbc:CityName>{_t(documento.get('ciudad_adquirente'))}</cbc:CityName>"
        "<cac:AddressLine>"
        f"<cbc:Line>{_t(documento.get('direccion_adquirente'))}</cbc:Line>"
        "</cac:AddressLine>"
        "<cac:Country>"
        f"<cbc:IdentificationCode>{PAIS}</cbc:IdentificationCode>"
        '<cbc:Name languageID="es">Colombia</cbc:Name>'
        "</cac:Country>"
    )
    partes.append("</cac:Address>")
    partes.append("</cac:PartyLegalEntity>")
    if documento.get("telefono_adquirente") or documento.get("correo_adquirente"):
        partes.append("<cac:Contact>")
        partes.append(
            f"<cbc:Telephone>{_t(documento.get('telefono_adquirente'))}</cbc:Telephone>"
            f"<cbc:ElectronicMail>{_t(documento.get('correo_adquirente'))}</cbc:ElectronicMail>"
        )
        partes.append("</cac:Contact>")
    partes.append("</cac:Party>")
    partes.append("</cac:AccountingCustomerParty>")

    # --- forma de pago ---------------------------------------------------
    partes.append("<cac:PaymentMeans>")
    partes.append(f"<cbc:ID>{_t(documento.get('forma_pago') or '1')}</cbc:ID>")
    partes.append(
        f"<cbc:PaymentMeansCode>{_t(documento.get('medio_pago') or '10')}</cbc:PaymentMeansCode>"
    )
    partes.append(f"<cbc:PaymentDueDate>{fecha_txt}</cbc:PaymentDueDate>")
    partes.append(f"<cbc:PaymentID>{_t(numero)}</cbc:PaymentID>")
    partes.append("</cac:PaymentMeans>")

    # --- impuestos totales -----------------------------------------------
    partes.append("<cac:TaxTotal>")
    partes.append(
        f'<cbc:TaxAmount currencyID="{_t(documento.get("moneda") or "COP")}">'
        f"{_v(documento.get('total_iva'))}</cbc:TaxAmount>"
    )
    partes.append("<cac:TaxSubtotal>")
    partes.append(
        f'<cbc:TaxableAmount currencyID="COP">{_v(documento.get("valor_bruto"))}</cbc:TaxableAmount>'
        f'<cbc:TaxAmount currencyID="COP">{_v(documento.get("total_iva"))}</cbc:TaxAmount>'
        "<cac:TaxCategory><cbc:Percent>19.00</cbc:Percent>"
        "<cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme>"
        "</cac:TaxCategory>"
    )
    partes.append("</cac:TaxSubtotal>")
    partes.append("</cac:TaxTotal>")

    # --- totales ---------------------------------------------------------
    partes.append("<cac:LegalMonetaryTotal>")
    partes.append(
        f'<cbc:LineExtensionAmount currencyID="COP">{_v(documento.get("valor_bruto"))}</cbc:LineExtensionAmount>'
        f'<cbc:TaxExclusiveAmount currencyID="COP">{_v(documento.get("valor_bruto"))}</cbc:TaxExclusiveAmount>'
        f'<cbc:TaxInclusiveAmount currencyID="COP">{_v(documento.get("total_factura"))}</cbc:TaxInclusiveAmount>'
        f'<cbc:AllowanceTotalAmount currencyID="COP">{_v(documento.get("descuento_total"))}</cbc:AllowanceTotalAmount>'
        f'<cbc:PayableAmount currencyID="COP">{_v(documento.get("total_factura"))}</cbc:PayableAmount>'
    )
    partes.append("</cac:LegalMonetaryTotal>")

    # --- lineas ----------------------------------------------------------
    for linea in lineas:
        partes.append("<cac:InvoiceLine>")
        partes.append(f"<cbc:ID>{_t(linea.get('numero_linea'))}</cbc:ID>")
        partes.append(
            f'<cbc:InvoicedQuantity unitCode="{_t(linea.get("unidad_medida") or UNIDAD_DEFECTO)}">'
            f"{_q(linea.get('cantidad'))}</cbc:InvoicedQuantity>"
        )
        partes.append(
            f'<cbc:LineExtensionAmount currencyID="COP">{_v(linea.get("total_linea"))}</cbc:LineExtensionAmount>'
        )
        partes.append("<cac:TaxTotal>")
        partes.append(
            f'<cbc:TaxAmount currencyID="COP">{_v(linea.get("iva_valor"))}</cbc:TaxAmount>'
            f'<cac:TaxSubtotal><cbc:TaxableAmount currencyID="COP">{_v(linea.get("total_linea"))}</cbc:TaxableAmount>'
            f'<cbc:TaxAmount currencyID="COP">{_v(linea.get("iva_valor"))}</cbc:TaxAmount>'
            f"<cac:TaxCategory><cbc:Percent>{_v(linea.get('iva_porcentaje'))}</cbc:Percent>"
            "<cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme>"
            "</cac:TaxCategory></cac:TaxSubtotal>"
        )
        partes.append("</cac:TaxTotal>")
        partes.append("<cac:Item>")
        partes.append(f"<cbc:Description>{_t(linea.get('descripcion'))}</cbc:Description>")
        partes.append(
            "<cac:SellersItemIdentification>"
            f"<cbc:ID>{_t(linea.get('codigo_producto'))}</cbc:ID>"
            "</cac:SellersItemIdentification>"
        )
        partes.append("</cac:Item>")
        partes.append("<cac:Price>")
        partes.append(
            f'<cbc:PriceAmount currencyID="COP">{_v(linea.get("precio_unitario"))}</cbc:PriceAmount>'
        )
        partes.append("</cac:Price>")
        partes.append("</cac:InvoiceLine>")

    partes.append("</Invoice>")

    return "".join(partes)
