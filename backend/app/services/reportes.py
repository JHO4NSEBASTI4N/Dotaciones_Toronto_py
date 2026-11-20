"""Genera archivos Excel editables y PDF con gráficas de reportes administrativos."""

from datetime import datetime
from io import BytesIO
from xml.sax.saxutils import escape

from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.drawing.image import Image as XLImage
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from PIL import Image as PILImage, ImageDraw
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.shapes import Drawing, Polygon, Rect
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    LongTable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table as PdfTable,
    TableStyle,
)

from app.schemas.reportes import ReporteAdminEntrada

NAVY = "0F172A"
ACCENT = "FA813B"  # Naranja corporativo institucional
LIGHT_BG = "F8FAFC"
MUTED = "64748B"
WHITE = "FFFFFF"

EMPRESA_NOMBRE = "DOTACIONES TORONTO S.A.S."
EMPRESA_NIT = "NIT 52520075_2"
EMPRESA_DIRECCION = "Calle 8va sur #69a78"
EMPRESA_TELEFONO = "321 2099989"
EMPRESA_CORREO = "dotacioneselobrero@gmail.com"


def _celda_segura(valor):
    if isinstance(valor, str) and valor.startswith(("=", "+", "-", "@")):
        return "'" + valor
    return valor


def _valor_excel(valor):
    if valor is None:
        return "—"
    if isinstance(valor, bool):
        return "Sí" if valor else "No"
    return _celda_segura(valor)


def _valor_numerico_o_texto(valor):
    """Convierte cadenas numéricas (ej. '7') a número real para que Excel grafique bien."""
    if isinstance(valor, (int, float)) and not isinstance(valor, bool):
        return valor
    if isinstance(valor, str):
        limpio = valor.strip().replace(",", "")
        if limpio.isdigit():
            return int(limpio)
        try:
            return float(limpio)
        except ValueError:
            return _celda_segura(valor)
    return _valor_excel(valor)


def _crear_imagen_logo_excel(tamano: int = 84) -> XLImage:
    """Genera el logotipo corporativo en PNG para insertarlo en Excel."""
    img = PILImage.new("RGBA", (tamano, tamano), (255, 255, 255, 0))
    dibujo = ImageDraw.Draw(img)

    escala = tamano / 40.0
    triangulo = [
        (20 * escala, (40 - 38) * escala),
        (2 * escala, (40 - 4) * escala),
        (38 * escala, (40 - 4) * escala),
    ]
    dibujo.polygon(triangulo, fill=(250, 129, 59, 255))

    dibujo.rectangle(
        [13 * escala, (40 - 25) * escala, 27 * escala, (40 - 20) * escala],
        fill=(255, 255, 255, 255),
    )
    dibujo.rectangle(
        [18 * escala, (40 - 22) * escala, 22 * escala, (40 - 9) * escala],
        fill=(255, 255, 255, 255),
    )

    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    xl_img = XLImage(buffer)
    xl_img.width = 68
    xl_img.height = 68
    return xl_img


def _crear_excel(reporte: ReporteAdminEntrada) -> bytes:
    libro = Workbook()
    resumen = libro.active
    resumen.title = "Reporte"
    resumen.sheet_view.showGridLines = True
    resumen.sheet_properties.tabColor = ACCENT

    total_columnas_tabla = max(len(reporte.columnas), 2)
    letra_max_tabla = get_column_letter(total_columnas_tabla)

    borde_delgado = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )

    # 1. Encabezado institucional + Logo a la derecha
    resumen["A1"] = EMPRESA_NOMBRE
    resumen["A1"].font = Font(name="Segoe UI", size=13, bold=True, color=NAVY)

    info_empresa = [
        EMPRESA_NIT,
        EMPRESA_DIRECCION,
        EMPRESA_TELEFONO,
        EMPRESA_CORREO,
    ]
    for idx, texto in enumerate(info_empresa, start=2):
        resumen[f"A{idx}"] = texto
        resumen[f"A{idx}"].font = Font(name="Segoe UI", size=9, color=MUTED)

    logo_excel = _crear_imagen_logo_excel()
    resumen.add_image(logo_excel, f"{letra_max_tabla}1")

    # 2. Título del reporte
    resumen.merge_cells(f"A7:{letra_max_tabla}7")
    resumen["A7"] = _celda_segura(reporte.titulo.upper())
    resumen["A7"].font = Font(name="Segoe UI", size=11, bold=True, color=WHITE)
    resumen["A7"].fill = PatternFill("solid", fgColor=ACCENT)
    resumen["A7"].alignment = Alignment(vertical="center", indent=1)
    resumen.row_dimensions[7].height = 26

    generado = datetime.now().astimezone().strftime("%d/%m/%Y %H:%M")
    resumen["A8"] = f"Generado por {reporte.generado_por} | {generado}"
    resumen["A8"].font = Font(name="Segoe UI", size=9, color=MUTED, italic=True)

    # 3. Sección: Resumen / Indicadores
    resumen.merge_cells(f"A10:{letra_max_tabla}10")
    resumen["A10"] = "RESUMEN"
    resumen["A10"].font = Font(name="Segoe UI", size=10, bold=True, color=WHITE)
    resumen["A10"].fill = PatternFill("solid", fgColor=ACCENT)
    resumen["A10"].alignment = Alignment(vertical="center", indent=1)
    resumen.row_dimensions[10].height = 22

    resumen["A11"] = "Indicador"
    resumen["B11"] = "Valor"
    for col in ["A", "B"]:
        celda = resumen[f"{col}11"]
        celda.font = Font(name="Segoe UI", size=9, bold=True, color=WHITE)
        celda.fill = PatternFill("solid", fgColor=NAVY)
        celda.alignment = Alignment(vertical="center", horizontal="center")

    fila_actual = 12
    fila_inicio_resumen = fila_actual
    for indicador in reporte.indicadores:
        c1 = resumen.cell(row=fila_actual, column=1, value=_celda_segura(indicador.etiqueta))
        c2 = resumen.cell(row=fila_actual, column=2, value=_valor_numerico_o_texto(indicador.valor))
        c1.font = Font(name="Segoe UI", size=9, color=NAVY)
        c2.font = Font(name="Segoe UI", size=9, bold=True, color=NAVY)
        c1.border = borde_delgado
        c2.border = borde_delgado
        c2.alignment = Alignment(horizontal="center")
        fila_actual += 1
    fila_fin_resumen = max(fila_actual - 1, fila_inicio_resumen)

    fila_actual += 1

    # 4. Sección: Gráfica analítica en su propio bloque sin invadir la tabla
    if reporte.indicadores:
        resumen.merge_cells(f"A{fila_actual}:{letra_max_tabla}{fila_actual}")
        resumen[f"A{fila_actual}"] = "ANÁLISIS GRÁFICO"
        resumen[f"A{fila_actual}"].font = Font(name="Segoe UI", size=10, bold=True, color=WHITE)
        resumen[f"A{fila_actual}"].fill = PatternFill("solid", fgColor=ACCENT)
        resumen[f"A{fila_actual}"].alignment = Alignment(vertical="center", indent=1)
        resumen.row_dimensions[fila_actual].height = 22
        fila_actual += 1

        fila_grafica = fila_actual
        chart = BarChart()
        chart.type = "col"
        chart.style = 10
        chart.title = reporte.grafica.titulo if reporte.grafica and reporte.grafica.titulo else "Indicadores del reporte"
        chart.y_axis.title = "Cantidad"
        chart.x_axis.title = None
        chart.legend = None
        chart.width = 22
        chart.height = 9.5

        datos_ref = Reference(
            resumen,
            min_col=2,
            min_row=11,
            max_row=fila_fin_resumen,
        )
        cats_ref = Reference(
            resumen,
            min_col=1,
            min_row=fila_inicio_resumen,
            max_row=fila_fin_resumen,
        )
        chart.add_data(datos_ref, titles_from_data=True)
        chart.set_categories(cats_ref)

        for serie in chart.series:
            serie.graphicalProperties.solidFill = ACCENT
            serie.graphicalProperties.line.solidFill = ACCENT

        resumen.add_chart(chart, f"A{fila_grafica}")
        # Reservar ~19 filas de alto para que la gráfica no toque la tabla inferior
        fila_actual = fila_grafica + 19

    fila_actual += 1

    # 5. Sección: Detalle de Registros
    resumen.merge_cells(f"A{fila_actual}:{letra_max_tabla}{fila_actual}")
    resumen[f"A{fila_actual}"] = "DETALLE DE REGISTROS"
    resumen[f"A{fila_actual}"].font = Font(name="Segoe UI", size=10, bold=True, color=WHITE)
    resumen[f"A{fila_actual}"].fill = PatternFill("solid", fgColor=ACCENT)
    resumen[f"A{fila_actual}"].alignment = Alignment(vertical="center", indent=1)
    resumen.row_dimensions[fila_actual].height = 22

    fila_actual += 1

    for indice_col, columna in enumerate(reporte.columnas, start=1):
        celda = resumen.cell(row=fila_actual, column=indice_col, value=columna.titulo)
        celda.font = Font(name="Segoe UI", size=9, bold=True, color=WHITE)
        celda.fill = PatternFill("solid", fgColor=NAVY)
        celda.alignment = Alignment(vertical="center", horizontal="center", wrap_text=True)
        celda.border = borde_delgado
    resumen.row_dimensions[fila_actual].height = 24

    fila_actual += 1

    for fila_datos in reporte.filas:
        resumen.row_dimensions[fila_actual].height = 20
        for indice_col, columna in enumerate(reporte.columnas, start=1):
            valor_celda = _valor_excel(fila_datos.get(columna.clave))
            celda = resumen.cell(row=fila_actual, column=indice_col, value=valor_celda)
            celda.font = Font(name="Segoe UI", size=9, color=NAVY)
            celda.border = borde_delgado

            clave = columna.clave.lower()
            if any(k in clave for k in ["stock", "minimo", "id", "cantidad", "total"]):
                celda.alignment = Alignment(horizontal="right", vertical="center")
            elif any(k in clave for k in ["estado", "talla", "color", "fecha"]):
                celda.alignment = Alignment(horizontal="center", vertical="center")
            else:
                celda.alignment = Alignment(horizontal="left", vertical="center")
        fila_actual += 1

    for col in range(1, total_columnas_tabla + 1):
        letra = get_column_letter(col)
        resumen.column_dimensions[letra].width = 18

    archivo = BytesIO()
    libro.save(archivo)
    return archivo.getvalue()


def _crear_logo_vectorial() -> Drawing:
    d = Drawing(40, 40)
    d.add(
        Polygon(
            [20, 38, 2, 4, 38, 4],
            fillColor=colors.HexColor(f"#{ACCENT}"),
            strokeColor=colors.HexColor(f"#{ACCENT}"),
            strokeWidth=1,
        )
    )
    d.add(Rect(13, 20, 14, 5, fillColor=colors.white, strokeColor=None))
    d.add(Rect(18, 9, 4, 13, fillColor=colors.white, strokeColor=None))
    return d


def _dibujar_encabezado_pie(canvas, documento):
    ancho, alto = landscape(A4)
    canvas.saveState()
    canvas.setFillColor(colors.HexColor(f"#{ACCENT}"))
    canvas.rect(0, alto - 8, ancho, 8, fill=1, stroke=0)

    canvas.setStrokeColor(colors.HexColor("#CBD5E1"))
    canvas.line(documento.leftMargin, 26, ancho - documento.rightMargin, 26)
    canvas.setFillColor(colors.HexColor(f"#{MUTED}"))
    canvas.setFont("Helvetica", 8)
    canvas.drawString(
        documento.leftMargin,
        14,
        "Dotaciones Toronto S.A.S. — Documento para control interno y auditoría",
    )
    canvas.drawRightString(ancho - documento.rightMargin, 14, f"Página {documento.page}")
    canvas.restoreState()


def _crear_grafica_pdf(reporte: ReporteAdminEntrada) -> Drawing:
    ancho, alto = 730, 155
    dibujo = Drawing(ancho, alto)
    grafica = VerticalBarChart()
    grafica.x = 40
    grafica.y = 20
    grafica.width = 670
    grafica.height = 110
    grafica.data = [tuple(serie.valores) for serie in reporte.grafica.series]
    grafica.categoryAxis.categoryNames = reporte.grafica.categorias
    grafica.categoryAxis.labels.fontName = "Helvetica"
    grafica.categoryAxis.labels.fontSize = 8
    grafica.categoryAxis.labels.angle = 15 if len(reporte.grafica.categorias) > 5 else 0
    grafica.categoryAxis.labels.dy = -10
    grafica.valueAxis.labels.fontName = "Helvetica"
    grafica.valueAxis.labels.fontSize = 8
    grafica.valueAxis.valueMin = 0
    grafica.valueAxis.visibleGrid = True
    grafica.barWidth = min(26, max(10, 480 / max(len(reporte.grafica.categorias), 1)))
    grafica.groupSpacing = 12

    paleta = [
        colors.HexColor(f"#{ACCENT}"),
        colors.HexColor(f"#{NAVY}"),
        colors.HexColor("#D97706"),
        colors.HexColor("#166534"),
    ]
    for indice in range(len(reporte.grafica.series)):
        grafica.bars[indice].fillColor = paleta[indice % len(paleta)]
        grafica.bars[indice].strokeColor = paleta[indice % len(paleta)]
    dibujo.add(grafica)
    return dibujo


def _crear_pdf(reporte: ReporteAdminEntrada) -> bytes:
    archivo = BytesIO()
    documento = SimpleDocTemplate(
        archivo,
        pagesize=landscape(A4),
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=24,
        bottomMargin=36,
        title=reporte.titulo,
        author="Dotaciones Toronto",
    )
    estilos = getSampleStyleSheet()

    estilos.add(
        ParagraphStyle(
            name="TituloSuperiorSofisticado",
            parent=estilos["Title"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=28,
            textColor=colors.HexColor(f"#{NAVY}"),
            alignment=TA_LEFT,
            spaceAfter=2,
        )
    )
    estilos.add(
        ParagraphStyle(
            name="MarcaSuperior",
            parent=estilos["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor(f"#{ACCENT}"),
            spaceAfter=2,
        )
    )
    estilos.add(
        ParagraphStyle(
            name="SubtituloToronto",
            parent=estilos["Normal"],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor(f"#{MUTED}"),
            spaceAfter=4,
        )
    )
    estilos.add(
        ParagraphStyle(
            name="InfoEmpresaDerecha",
            parent=estilos["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor(f"#{MUTED}"),
            alignment=TA_RIGHT,
        )
    )
    estilos.add(
        ParagraphStyle(
            name="CeldaToronto",
            parent=estilos["Normal"],
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#0F172A"),
            wordWrap="CJK",
        )
    )
    estilos.add(
        ParagraphStyle(
            name="SeccionTitulo",
            parent=estilos["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=colors.HexColor(f"#{ACCENT}"),
            spaceBefore=4,
            spaceAfter=2,
        )
    )

    generado = datetime.now().astimezone().strftime("%d/%m/%Y %H:%M")
    logo = _crear_logo_vectorial()

    info_empresa = Paragraph(
        f"<b>{escape(EMPRESA_NIT)}</b><br/>"
        f"{escape(EMPRESA_DIRECCION)}<br/>"
        f"Tel: {escape(EMPRESA_TELEFONO)}<br/>"
        f"{escape(EMPRESA_CORREO)}",
        estilos["InfoEmpresaDerecha"],
    )

    bloque_titulo_superior = PdfTable(
        [
            [
                Paragraph(escape(reporte.titulo.upper()), estilos["TituloSuperiorSofisticado"]),
            ]
        ],
        colWidths=[landscape(A4)[0] - 32 * mm],
    )
    bloque_titulo_superior.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 0), (-1, -1), 1.5, colors.HexColor(f"#{ACCENT}")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    tabla_empresa = PdfTable(
        [
            [
                logo,
                [
                    Paragraph(escape(EMPRESA_NOMBRE), estilos["MarcaSuperior"]),
                    Paragraph(
                        f"Generado por <b>{escape(reporte.generado_por)}</b> el {generado}",
                        estilos["SubtituloToronto"],
                    ),
                ],
                info_empresa,
            ]
        ],
        colWidths=[46, landscape(A4)[0] - 32 * mm - 220, 174],
    )
    tabla_empresa.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (1, 0), (1, 0), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("ALIGN", (2, 0), (2, 0), "RIGHT"),
            ]
        )
    )

    contenido = [bloque_titulo_superior, tabla_empresa, Spacer(1, 4)]

    if reporte.indicadores:
        celdas = []
        for indicador in reporte.indicadores[:6]:
            celdas.append(
                Paragraph(
                    f'<font color="#{MUTED}"><b>{escape(indicador.etiqueta).upper()}</b></font>'
                    f'<br/><font color="#{ACCENT}" size="14"><b>{escape(indicador.valor)}</b></font>',
                    estilos["Normal"],
                )
            )
        tabla_indicadores = PdfTable(
            [celdas],
            colWidths=[(landscape(A4)[0] - 32 * mm) / len(celdas)] * len(celdas),
            hAlign="LEFT",
        )
        tabla_indicadores.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(f"#{LIGHT_BG}")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        contenido.extend([tabla_indicadores, Spacer(1, 6)])

    contenido.extend(
        [
            Paragraph(f"<b>{escape(reporte.grafica.titulo.upper())}</b>", estilos["SeccionTitulo"]),
            Spacer(1, 2),
            _crear_grafica_pdf(reporte),
            Spacer(1, 6),
            Paragraph("<b>DETALLE DE REGISTROS</b>", estilos["SeccionTitulo"]),
            Spacer(1, 3),
        ]
    )

    ancho_disponible = landscape(A4)[0] - 32 * mm
    ancho_columna = ancho_disponible / len(reporte.columnas)
    encabezados = [
        Paragraph(
            f"<b>{escape(columna.titulo)}</b>",
            ParagraphStyle(
                name="HCol",
                parent=estilos["CeldaToronto"],
                textColor=colors.white,
                fontName="Helvetica-Bold",
            ),
        )
        for columna in reporte.columnas
    ]
    filas_tabla = [encabezados]
    for fila in reporte.filas:
        filas_tabla.append(
            [
                Paragraph(
                    escape(str(_valor_excel(fila.get(columna.clave)))),
                    estilos["CeldaToronto"],
                )
                for columna in reporte.columnas
            ]
        )
    tabla_datos = LongTable(
        filas_tabla,
        colWidths=[ancho_columna] * len(reporte.columnas),
        repeatRows=1,
        hAlign="LEFT",
        splitByRow=1,
    )
    tabla_datos.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(f"#{ACCENT}")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor(f"#{LIGHT_BG}")]),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    contenido.append(tabla_datos)
    documento.build(
        contenido,
        onFirstPage=_dibujar_encabezado_pie,
        onLaterPages=_dibujar_encabezado_pie,
    )
    return archivo.getvalue()


def generar_reporte(reporte: ReporteAdminEntrada, formato: str) -> tuple[bytes, str]:
    if formato == "excel":
        return (
            _crear_excel(reporte),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    if formato == "pdf":
        return _crear_pdf(reporte), "application/pdf"
    raise ValueError("Formato de reporte no compatible")