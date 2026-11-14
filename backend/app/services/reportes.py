"""Genera archivos Excel editables y PDF con gráficas de reportes administrativos."""

from datetime import datetime
from io import BytesIO
from xml.sax.saxutils import escape

from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    LongTable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table as PdfTable,
    TableStyle,
)

from app.schemas.reportes import ReporteAdminEntrada

NAVY = "16213A"
ORANGE = "FA813B"
GOLD = "E2B96F"
PALE = "F3F6FB"
MUTED = "64748B"
GREEN = "15803D"
WHITE = "FFFFFF"


def _celda_segura(valor):
    """Evita que texto de un reporte se interprete como fórmula en Excel."""
    if isinstance(valor, str) and valor.startswith(("=", "+", "-", "@")):
        return "'" + valor
    return valor


def _valor_excel(valor):
    if valor is None:
        return "—"
    if isinstance(valor, bool):
        return "Sí" if valor else "No"
    return _celda_segura(valor)


def _crear_excel(reporte: ReporteAdminEntrada) -> bytes:
    libro = Workbook()
    resumen = libro.active
    resumen.title = "Resumen"
    resumen.sheet_view.showGridLines = False
    resumen.sheet_properties.tabColor = ORANGE
    resumen.merge_cells("A1:L1")
    resumen["A1"] = _celda_segura(reporte.titulo)
    resumen["A1"].font = Font(name="Aptos Display", size=20, bold=True, color=WHITE)
    resumen["A1"].fill = PatternFill("solid", fgColor=NAVY)
    resumen["A1"].alignment = Alignment(vertical="center")
    resumen.row_dimensions[1].height = 38
    resumen.merge_cells("A2:L2")
    generado = datetime.now().astimezone().strftime("%d/%m/%Y %H:%M")
    resumen["A2"] = _celda_segura(
        f"DOTACIONES TORONTO  |  Generado por {reporte.generado_por}  |  {generado}"
    )
    resumen["A2"].font = Font(size=10, color=MUTED, italic=True)
    resumen["A2"].alignment = Alignment(vertical="center")

    for indice, indicador in enumerate(reporte.indicadores[:6]):
        columna = (indice % 3) * 4 + 1
        fila_etiqueta = 4 + (indice // 3) * 3
        fila_valor = fila_etiqueta + 1
        celda_etiqueta = resumen.cell(row=fila_etiqueta, column=columna, value=_celda_segura(indicador.etiqueta))
        celda_valor = resumen.cell(row=fila_valor, column=columna, value=_celda_segura(indicador.valor))
        for celda in (celda_etiqueta, celda_valor):
            resumen.merge_cells(
                start_row=celda.row,
                start_column=columna,
                end_row=celda.row,
                end_column=columna + 2,
            )
            celda.fill = PatternFill("solid", fgColor=PALE)
            celda.border = Border(
                bottom=Side(style="thin", color="DCE3ED"),
                left=Side(style="thin", color="DCE3ED"),
                right=Side(style="thin", color="DCE3ED"),
            )
        celda_etiqueta.font = Font(size=9, bold=True, color=MUTED)
        celda_etiqueta.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        celda_valor.font = Font(size=15, bold=True, color=NAVY)
        celda_valor.alignment = Alignment(horizontal="center", vertical="center")
        resumen.row_dimensions[fila_etiqueta].height = 22
        resumen.row_dimensions[fila_valor].height = 32
    for columna in range(1, 13):
        resumen.column_dimensions[get_column_letter(columna)].width = 13
    fila_grafica = 11 if len(reporte.indicadores) > 4 else 8

    datos_grafica = libro.create_sheet("Datos de gráfica")
    datos_grafica.sheet_view.showGridLines = False
    datos_grafica.append(["Categoría", *[serie.nombre for serie in reporte.grafica.series]])
    for numero_fila, categoria in enumerate(reporte.grafica.categorias):
        datos_grafica.append(
            [categoria]
            + [serie.valores[numero_fila] for serie in reporte.grafica.series]
        )
    for celda in datos_grafica[1]:
        celda.font = Font(bold=True, color=WHITE)
        celda.fill = PatternFill("solid", fgColor=NAVY)
    datos_grafica.freeze_panes = "A2"
    datos_grafica.column_dimensions["A"].width = 28
    for columna in range(2, len(reporte.grafica.series) + 2):
        datos_grafica.column_dimensions[chr(64 + columna)].width = 20

    if reporte.grafica.tipo == "linea":
        grafica = LineChart()
        grafica.style = 13
    else:
        grafica = BarChart()
        grafica.type = "col"
        grafica.style = 10
        grafica.grouping = "clustered"
    grafica.title = reporte.grafica.titulo
    grafica.y_axis.title = "Valor"
    grafica.x_axis.title = "Categoría"
    grafica.height = 8.5
    grafica.width = 19
    grafica.legend.position = "b"
    grafica_data = Reference(
        datos_grafica,
        min_col=2,
        max_col=len(reporte.grafica.series) + 1,
        min_row=1,
        max_row=len(reporte.grafica.categorias) + 1,
    )
    categorias = Reference(
        datos_grafica,
        min_col=1,
        min_row=2,
        max_row=len(reporte.grafica.categorias) + 1,
    )
    grafica.add_data(grafica_data, titles_from_data=True)
    grafica.set_categories(categorias)
    grafica.dataLabels = DataLabelList()
    grafica.dataLabels.showVal = True
    resumen.add_chart(grafica, f"A{fila_grafica}")

    hoja_datos = libro.create_sheet("Datos")
    hoja_datos.sheet_view.showGridLines = False
    hoja_datos.freeze_panes = "A2"
    hoja_datos.append([columna.titulo for columna in reporte.columnas])
    for fila in reporte.filas:
        hoja_datos.append(
            [_valor_excel(fila.get(columna.clave)) for columna in reporte.columnas]
        )
    for celda in hoja_datos[1]:
        celda.font = Font(bold=True, color=WHITE)
        celda.fill = PatternFill("solid", fgColor=NAVY)
        celda.alignment = Alignment(vertical="center", wrap_text=True)
    hoja_datos.row_dimensions[1].height = 28
    for indice, columna in enumerate(reporte.columnas, start=1):
        muestras = [columna.titulo]
        muestras.extend(str(fila.get(columna.clave) or "") for fila in reporte.filas[:250])
        largo = max((len(texto) for texto in muestras), default=12)
        hoja_datos.column_dimensions[hoja_datos.cell(row=1, column=indice).column_letter].width = min(
            max(largo + 2, 13), 38
        )
    if reporte.filas:
        ultima = hoja_datos.cell(row=hoja_datos.max_row, column=hoja_datos.max_column).coordinate
        tabla = Table(displayName="TablaReporteAdmin", ref=f"A1:{ultima}")
        tabla.tableStyleInfo = TableStyleInfo(
            name="TableStyleMedium2",
            showFirstColumn=False,
            showLastColumn=False,
            showRowStripes=True,
            showColumnStripes=False,
        )
        hoja_datos.add_table(tabla)
    else:
        hoja_datos.auto_filter.ref = f"A1:{hoja_datos.cell(row=1, column=len(reporte.columnas)).coordinate}"
    hoja_datos.sheet_properties.pageSetUpPr.fitToPage = True

    archivo = BytesIO()
    libro.save(archivo)
    return archivo.getvalue()


def _dibujar_encabezado_pie(canvas, documento):
    ancho, alto = landscape(A4)
    canvas.saveState()
    canvas.setFillColor(colors.HexColor(f"#{NAVY}"))
    canvas.rect(0, alto - 10, ancho, 10, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor(f"#{NAVY}"))
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(documento.leftMargin, alto - 29, "DOTACIONES TORONTO")
    canvas.setFillColor(colors.HexColor(f"#{MUTED}"))
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(ancho - documento.rightMargin, alto - 29, "REPORTE ADMINISTRATIVO")
    canvas.setStrokeColor(colors.HexColor("#DCE3ED"))
    canvas.line(documento.leftMargin, 25, ancho - documento.rightMargin, 25)
    canvas.setFillColor(colors.HexColor(f"#{MUTED}"))
    canvas.drawString(documento.leftMargin, 13, "Documento generado por el sistema de gestión")
    canvas.drawRightString(ancho - documento.rightMargin, 13, f"Página {documento.page}")
    canvas.restoreState()


def _crear_grafica_pdf(reporte: ReporteAdminEntrada) -> Drawing:
    ancho, alto = 730, 230
    dibujo = Drawing(ancho, alto)
    grafica = VerticalBarChart()
    grafica.x = 42
    grafica.y = 50
    grafica.width = 660
    grafica.height = 150
    grafica.data = [tuple(serie.valores) for serie in reporte.grafica.series]
    grafica.categoryAxis.categoryNames = reporte.grafica.categorias
    grafica.categoryAxis.labels.fontName = "Helvetica"
    grafica.categoryAxis.labels.fontSize = 7
    grafica.categoryAxis.labels.angle = 25 if len(reporte.grafica.categorias) > 5 else 0
    grafica.categoryAxis.labels.dy = -14
    grafica.valueAxis.labels.fontName = "Helvetica"
    grafica.valueAxis.labels.fontSize = 7
    grafica.valueAxis.valueMin = 0
    grafica.valueAxis.labels.leftPadding = 2
    grafica.valueAxis.visibleGrid = True
    grafica.barWidth = min(24, max(8, 500 / max(len(reporte.grafica.categorias), 1)))
    grafica.groupSpacing = 10
    grafica.barSpacing = 3
    paleta = [colors.HexColor(f"#{ORANGE}"), colors.HexColor(f"#{NAVY}"), colors.HexColor(f"#{GOLD}"), colors.HexColor(f"#{GREEN}")]
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
        topMargin=42,
        bottomMargin=34,
        title=reporte.titulo,
        author="Dotaciones Toronto",
    )
    estilos = getSampleStyleSheet()
    estilos.add(
        ParagraphStyle(
            name="TituloReporteToronto",
            parent=estilos["Title"],
            fontName="Helvetica-Bold",
            fontSize=21,
            leading=25,
            textColor=colors.HexColor(f"#{NAVY}"),
            alignment=TA_LEFT,
            spaceAfter=4,
        )
    )
    estilos.add(
        ParagraphStyle(
            name="SubtituloReporteToronto",
            parent=estilos["Normal"],
            fontSize=9,
            leading=13,
            textColor=colors.HexColor(f"#{MUTED}"),
            spaceAfter=12,
        )
    )
    estilos.add(
        ParagraphStyle(
            name="CeldaReporteToronto",
            parent=estilos["Normal"],
            fontSize=7.5,
            leading=9,
            textColor=colors.HexColor("#263247"),
            wordWrap="CJK",
        )
    )
    generado = datetime.now().astimezone().strftime("%d/%m/%Y %H:%M")
    contenido = [
        Paragraph(escape(reporte.titulo), estilos["TituloReporteToronto"]),
        Paragraph(
            f"Generado por {escape(reporte.generado_por)} el {generado} · "
            f"{len(reporte.filas):,} registro(s)",
            estilos["SubtituloReporteToronto"],
        ),
    ]

    if reporte.indicadores:
        celdas = []
        for indicador in reporte.indicadores[:6]:
            celdas.append(
                Paragraph(
                    f'<font color="#{MUTED}"><b>{escape(indicador.etiqueta)}</b></font>'
                    f'<br/><font color="#{NAVY}" size="14"><b>{escape(indicador.valor)}</b></font>',
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
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(f"#{PALE}")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#DCE3ED")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DCE3ED")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, -1), 9),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ]
            )
        )
        contenido.extend([tabla_indicadores, Spacer(1, 12)])

    contenido.extend(
        [
            Paragraph(f"<b>{escape(reporte.grafica.titulo)}</b>", estilos["Heading2"]),
            Spacer(1, 4),
            _crear_grafica_pdf(reporte),
            Spacer(1, 8),
            Paragraph("<b>Detalle de registros</b>", estilos["Heading2"]),
            Spacer(1, 5),
        ]
    )

    ancho_disponible = landscape(A4)[0] - 32 * mm
    ancho_columna = ancho_disponible / len(reporte.columnas)
    encabezados = [
        Paragraph(f"<b>{escape(columna.titulo)}</b>", estilos["CeldaReporteToronto"])
        for columna in reporte.columnas
    ]
    filas_tabla = [encabezados]
    for fila in reporte.filas:
        filas_tabla.append(
            [
                Paragraph(
                    escape(str(_valor_excel(fila.get(columna.clave)))),
                    estilos["CeldaReporteToronto"],
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
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(f"#{NAVY}")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor(f"#{PALE}")]),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#DCE3ED")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
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
    """Genera y devuelve el contenido binario y su tipo MIME."""
    if formato == "excel":
        return (
            _crear_excel(reporte),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    if formato == "pdf":
        return _crear_pdf(reporte), "application/pdf"
    raise ValueError("Formato de reporte no compatible")
