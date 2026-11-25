"""Representación gráfica descargable de una factura electrónica DIAN.

El PDF se arma exclusivamente desde el registro DIAN (no desde la factura
comercial interna de Ventas) e incluye CUFE, resolución, impuestos y QR.
"""
from decimal import Decimal
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.graphics import renderPDF


NAVY = colors.HexColor("#16213e")
ORANGE = colors.HexColor("#e87932")
MUTED = colors.HexColor("#64748b")
LIGHT = colors.HexColor("#f1f5f9")
BORDER = colors.HexColor("#dbe2ea")


def _texto(valor, fallback="—"):
    return escape(str(valor)) if valor not in (None, "") else fallback


def _dato(objeto, campo, predeterminado=None):
    if isinstance(objeto, dict):
        return objeto.get(campo, predeterminado)
    return getattr(objeto, campo, predeterminado)


def _pesos(valor):
    try:
        numero = Decimal(str(valor or 0))
    except Exception:
        numero = Decimal("0")
    return "$ " + f"{numero:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _fecha(valor):
    if not valor:
        return "—"
    return valor.strftime("%d/%m/%Y %H:%M") if hasattr(valor, "strftime") else str(valor)


def generar_pdf_representacion(factura: dict) -> bytes:
    """Devuelve el PDF de representación gráfica para el mismo registro DIAN."""
    salida = BytesIO()
    doc = SimpleDocTemplate(
        salida,
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=15 * mm,
        title=f"Representación gráfica {factura.get('numero_factura', '')}",
        author=factura.get("razon_social_emisor") or "Dotaciones Toronto",
    )
    base = getSampleStyleSheet()
    titulo = ParagraphStyle("TituloFactura", parent=base["Title"], fontName="Helvetica-Bold", fontSize=15, leading=18, textColor=NAVY, alignment=TA_RIGHT, spaceAfter=3)
    normal = ParagraphStyle("NormalFactura", parent=base["BodyText"], fontName="Helvetica", fontSize=8.5, leading=12, textColor=NAVY)
    small = ParagraphStyle("SmallFactura", parent=normal, fontSize=7.5, leading=10, textColor=MUTED)
    small_dark = ParagraphStyle("SmallDarkFactura", parent=small, textColor=NAVY)
    section = ParagraphStyle("SeccionFactura", parent=normal, fontName="Helvetica-Bold", fontSize=8, textColor=NAVY, spaceAfter=4)
    right = ParagraphStyle("RightFactura", parent=normal, alignment=TA_RIGHT)
    right_small = ParagraphStyle("RightSmallFactura", parent=small_dark, alignment=TA_RIGHT)
    story = []

    emisor = "<br/>".join([
        f"<b>{_texto(factura.get('razon_social_emisor'), 'DOTACIONES TORONTO S.A.S.')}</b>",
        f"NIT: {_texto(factura.get('nit_emisor'))}-{_texto(factura.get('dv_emisor'), '')}",
        _texto(factura.get("direccion_emisor")),
        " · ".join(filter(None, [factura.get("ciudad_emisor"), factura.get("departamento_emisor")])),
        " · ".join(filter(None, [factura.get("telefono_emisor"), factura.get("correo_emisor")])),
    ])
    encabezado = Table([
        [Paragraph(emisor, normal), Paragraph(f"FACTURA ELECTRÓNICA DE VENTA<br/><font size='17'><b>{_texto(factura.get('numero_factura'))}</b></font><br/><font size='8'>Fecha: {_fecha(factura.get('fecha_emision'))}</font>", titulo)]
    ], colWidths=[100 * mm, 78 * mm])
    encabezado.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 2, NAVY),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story += [encabezado, Spacer(1, 8 * mm)]

    if factura.get("simulado"):
        aviso = Table([[Paragraph(
            "<b>DOCUMENTO SIMULADO · SIN VALIDEZ FISCAL · NO TRANSMITIDO A LA DIAN</b>",
            ParagraphStyle("AvisoSimulado", parent=normal, textColor=colors.HexColor("#92400e"), alignment=1, fontSize=8.5),
        )]], colWidths=[178 * mm])
        aviso.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fff7e6")),
            ("BOX", (0, 0), (-1, -1), .6, colors.HexColor("#f3c969")),
            ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]))
        story += [aviso, Spacer(1, 5 * mm)]

    cliente = "<br/>".join([
        f"<b>{_texto(factura.get('razon_social_adquirente'), 'Consumidor final')}</b>",
        f"Documento: {_texto(factura.get('nit_adquirente'))}",
        f"Dirección: {_texto(factura.get('direccion_adquirente'))}",
        f"Ciudad: {_texto(factura.get('ciudad_adquirente'))} · Teléfono: {_texto(factura.get('telefono_adquirente'))}",
        f"Correo: {_texto(factura.get('correo_adquirente'))}",
    ])
    resolucion = "<br/>".join([
        f"<b>Resolución:</b> {_texto(factura.get('resolucion_numero'))}",
        f"<b>Rango autorizado:</b> {_texto(factura.get('resolucion_desde'))} – {_texto(factura.get('resolucion_hasta'))}",
        f"<b>Estado documento:</b> {_texto(factura.get('estado'))} · <b>Estado DIAN:</b> {_texto(factura.get('estado_dian'), 'Pendiente')}",
        f"<b>Forma / medio de pago:</b> {_texto(factura.get('forma_pago'))} / {_texto(factura.get('medio_pago'))}",
    ])
    cajas = Table([
        [Paragraph("ADQUIRENTE", section), Paragraph("DATOS DE FACTURACIÓN", section)],
        [Paragraph(cliente, small_dark), Paragraph(resolucion, small_dark)],
    ], colWidths=[89 * mm, 89 * mm])
    cajas.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT), ("BOX", (0, 0), (-1, -1), .5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), .4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("SPAN", (0, 0), (0, 0)), ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story += [cajas, Spacer(1, 6 * mm)]

    filas = [["Ítem / descripción", "Cant.", "Unitario", "Desc. info.", "Base", "IVA", "Total"]]
    for numero, linea in enumerate(factura.get("lineas") or [], start=1):
        cantidad = Decimal(str(_dato(linea, "cantidad") or 0))
        base_linea = Decimal(str(_dato(linea, "total_linea") or 0))
        iva = Decimal(str(_dato(linea, "iva_valor") or 0))
        descuento = Decimal(str(_dato(linea, "descuento") or 0))
        precio_unitario = Decimal(str(_dato(linea, "precio_unitario") or 0))
        codigo_producto = _dato(linea, "codigo_producto")
        filas.append([
            Paragraph(f"{numero}. {_texto(_dato(linea, 'descripcion'), 'Producto')}" + (f"<br/><font color='#64748b'>Código: {_texto(codigo_producto)}</font>" if codigo_producto else ""), small_dark),
            f"{cantidad:g}", _pesos(precio_unitario), _pesos(descuento), _pesos(base_linea), _pesos(iva), _pesos(base_linea + iva),
        ])
    tabla = Table(filas, colWidths=[52 * mm, 12 * mm, 24 * mm, 20 * mm, 23 * mm, 19 * mm, 28 * mm], repeatRows=1)
    tabla.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, 0), 7),
        ("ALIGN", (1, 1), (-1, -1), "RIGHT"), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), .35, BORDER), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story += [tabla, Spacer(1, 5 * mm)]

    total = Decimal(str(factura.get("total_factura") or 0))
    iva_total = Decimal(str(factura.get("total_iva") or 0))
    bruto = Decimal(str(factura.get("valor_bruto") or 0))
    descuento_total = Decimal(str(factura.get("descuento_total") or 0))
    resumen = Table([
        ["Valor bruto", _pesos(bruto)], ["Descuentos", _pesos(descuento_total)],
        ["IVA", _pesos(iva_total)], [Paragraph("<b>TOTAL A PAGAR</b>", normal), Paragraph(f"<b>{_pesos(total)}</b>", right)],
    ], colWidths=[48 * mm, 36 * mm], hAlign="RIGHT")
    resumen.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"), ("LINEABOVE", (0, -1), (-1, -1), 1.3, NAVY),
        ("BACKGROUND", (0, -1), (-1, -1), LIGHT), ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5), ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story += [resumen, Spacer(1, 6 * mm)]

    qr_url = factura.get("qr_url")
    cufe = factura.get("cufe")
    qr_drawing = None
    if qr_url:
        qr = QrCodeWidget(qr_url)
        bounds = qr.getBounds()
        ancho = bounds[2] - bounds[0]
        alto = bounds[3] - bounds[1]
        qr_drawing = Drawing(30 * mm, 30 * mm, transform=[30 * mm / ancho, 0, 0, 30 * mm / alto, 0, 0])
        qr_drawing.add(qr)
    qr_cell = qr_drawing if qr_drawing else Paragraph("QR no disponible", small)
    datos_cufe = Paragraph(
        "<b>CUFE</b><br/>" + (_texto(cufe, "No disponible")) +
        "<br/><br/><b>Consulta DIAN</b><br/>" + _texto(qr_url, "No disponible") +
        f"<br/><br/><b>Ambiente:</b> {_texto(factura.get('ambiente'), 'Pruebas')} · "
        f"<b>Pedido:</b> #{_texto(factura.get('id_pedido_fk'))} · <b>Venta:</b> #{_texto(factura.get('id_venta_fk'))}",
        small,
    )
    bloque_final = Table([[qr_cell, datos_cufe]], colWidths=[37 * mm, 141 * mm])
    bloque_final.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("BOX", (0, 0), (-1, -1), .6, BORDER),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white), ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6), ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(KeepTogether([bloque_final]))

    def pie(canvas, documento):
        canvas.saveState()
        canvas.setStrokeColor(BORDER)
        canvas.line(16 * mm, 11 * mm, A4[0] - 16 * mm, 11 * mm)
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(MUTED)
        canvas.drawString(16 * mm, 7 * mm, "Representación gráfica generada desde el registro de factura electrónica DIAN.")
        canvas.drawRightString(A4[0] - 16 * mm, 7 * mm, f"Página {documento.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=pie, onLaterPages=pie)
    return salida.getvalue()
