"""Genera el reporte de ventas del vendedor en formato Excel (.xlsx).

Usa `openpyxl`. Si no esta instalado, `generar_reporte_vendedor_xlsx` lanza
un error claro con la instruccion de instalacion (no rompe el arranque del
servidor: la importacion de openpyxl se hace al momento de generar).

El reporte incluye: datos de la empresa, logo, filtros aplicados, resumen
(productos vendidos, total de ventas, ingresos), metodos de pago utilizados
y el historial de transacciones.
"""

from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any

LOGO_PATH = Path(__file__).resolve().parent.parent / "assets" / "logo.png"

# --- Paleta de la marca ------------------------------------------------------
NARANJA = "FA813B"
NARANJA_OSCURO = "E06A28"
NARANJA_SUAVE = "FFF1E8"
TINTA = "0F172A"
GRIS = "64748B"


def _borde() -> Any:
    """Borde sutil para las tablas del reporte."""
    from openpyxl.styles import Border, Side

    lado = Side(style="thin", color="E2E8F0")
    return Border(top=lado, right=lado, bottom=lado, left=lado)


def _titulo(ws, fila: int, texto: str, ancho: int = 7) -> int:
    """Titulo de seccion con fondo naranja. Devuelve la siguiente fila libre."""
    from openpyxl.styles import Alignment, Font, PatternFill

    ws.cell(row=fila, column=1, value=texto)
    ws.merge_cells(start_row=fila, start_column=1, end_row=fila, end_column=ancho)
    celda = ws.cell(row=fila, column=1)
    celda.fill = PatternFill("solid", fgColor=NARANJA)
    celda.font = Font(bold=True, size=12, color="FFFFFF")
    celda.alignment = Alignment(horizontal="left", vertical="center")
    for col in range(1, ancho + 1):
        ws.cell(row=fila, column=col).fill = PatternFill("solid", fgColor=NARANJA)
    ws.row_dimensions[fila].height = 22
    return fila + 1


def _cabecera_tabla(ws, fila: int, valores: list[str]) -> int:
    """Fila de cabecera de una tabla (fondo naranja suave, negrita)."""
    from openpyxl.styles import Alignment, Font, PatternFill

    borde = _borde()
    for idx, valor in enumerate(valores, start=1):
        celda = ws.cell(row=fila, column=idx, value=valor)
        celda.fill = PatternFill("solid", fgColor=NARANJA_SUAVE)
        celda.font = Font(bold=True, size=10, color=NARANJA_OSCURO)
        celda.alignment = Alignment(horizontal="center", vertical="center")
        celda.border = borde
    return fila + 1


def _fila(ws, fila: int, valores: list[Any], formatos: dict[int, str] | None = None, negrita: bool = False) -> int:
    """Fila de datos. `formatos` mapea columna -> formato numérico/fecha."""
    from openpyxl.styles import Alignment, Font

    borde = _borde()
    formatos = formatos or {}
    for idx, valor in enumerate(valores, start=1):
        celda = ws.cell(row=fila, column=idx, value=valor)
        celda.font = Font(bold=negrita, size=10, color=TINTA)
        celda.alignment = Alignment(horizontal="left", vertical="center")
        celda.border = borde
        if idx in formatos and valor is not None:
            celda.number_format = formatos[idx]
    return fila + 1


def _anchos(ws, anchos: dict[int, int]) -> None:
    from openpyxl.utils import get_column_letter

    for col, ancho in anchos.items():
        ws.column_dimensions[get_column_letter(col)].width = ancho


def _datos_empresa(ws, empresa: dict, fila: int) -> int:
    """Logo + datos de la empresa en la parte superior del reporte."""
    from openpyxl.drawing.image import Image as XlImage
    from openpyxl.styles import Alignment, Font

    # Logo (si hay archivo y Pillow disponible)
    if LOGO_PATH.exists():
        try:
            imagen = XlImage(str(LOGO_PATH))
            imagen.width = 58
            imagen.height = 55
            ws.add_image(imagen, "A1")
        except Exception:
            # Sin Pillow o archivo: se sigue sin logo, el reporte no falla.
            pass

    ws.cell(row=1, column=2, value=empresa.get("razon_social", "DOTACIONES TORONTO S.A.S.")).font = Font(
        bold=True, size=16, color=TINTA
    )
    ws.merge_cells(start_row=1, start_column=2, end_row=1, end_column=6)
    ws.cell(row=2, column=2, value=empresa.get("nit", "")).font = Font(size=10, color=GRIS)
    ws.merge_cells(start_row=2, start_column=2, end_row=2, end_column=6)
    ws.cell(row=3, column=2, value=f"NIT {empresa.get('nit', '')} · {empresa.get('dv', '')}").font = Font(
        size=10, color=GRIS
    )
    ws.merge_cells(start_row=3, start_column=2, end_row=3, end_column=6)
    ws.cell(row=4, column=2, value=empresa.get("direccion", "")).font = Font(size=10, color=GRIS)
    ws.merge_cells(start_row=4, start_column=2, end_row=4, end_column=6)
    ws.cell(row=5, column=2, value=empresa.get("telefono", "")).font = Font(size=10, color=GRIS)
    ws.merge_cells(start_row=5, start_column=2, end_row=5, end_column=6)
    ws.cell(row=6, column=2, value=empresa.get("correo", "")).font = Font(size=10, color=GRIS)
    ws.merge_cells(start_row=6, start_column=2, end_row=6, end_column=6)
    return 8


def generar_reporte_vendedor_xlsx(
    reporte: dict, empresa: dict, filtros: dict
) -> bytes:
    """Construye el .xlsx del reporte del vendedor y devuelve los bytes."""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Font
    except ImportError as error:
        raise ImportError(
            "openpyxl no esta instalado. Para el reporte en Excel, ejecuta: "
            "pip install openpyxl pillow"
        ) from error

    wb = Workbook()
    ws = wb.active
    ws.title = "Reporte"
    _anchos(ws, {1: 14, 2: 22, 3: 26, 4: 14, 5: 18, 6: 14, 7: 22})

    fila = _datos_empresa(ws, empresa, 1)

    # --- Titulo del reporte -------------------------------------------------
    fila = _titulo(ws, fila, "REPORTE DE VENTAS DEL VENDEDOR")

    ws.cell(row=fila, column=1, value=f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}").font = Font(
        size=10, color=GRIS
    )
    ws.merge_cells(start_row=fila, start_column=1, end_row=fila, end_column=7)
    fila += 1

    estado = filtros.get("estado") or "Todas"
    ws.cell(
        row=fila,
        column=1,
        value=(
            f"Filtros: desde {filtros.get('fecha_desde') or '—'} · "
            f"hasta {filtros.get('fecha_hasta') or '—'} · estado: {estado}"
        ),
    ).font = Font(size=10, color=GRIS)
    ws.merge_cells(start_row=fila, start_column=1, end_row=fila, end_column=7)
    fila += 2

    # --- Resumen ------------------------------------------------------------
    fila = _titulo(ws, fila, "RESUMEN")
    fila = _cabecera_tabla(ws, fila, ["Indicador", "Valor"])
    fila = _fila(ws, fila, ["Cantidad de productos vendidos", reporte["total_unidades"]])
    fila = _fila(ws, fila, ["Total de ventas", reporte["ventas"]])
    fila = _fila(
        ws,
        fila,
        ["Total de ingresos", reporte["total_ingresos"]],
        formatos={2: '"$"#,##0.00'},
        negrita=True,
    )
    fila += 1

    # --- Metodos de pago ----------------------------------------------------
    fila = _titulo(ws, fila, "METODOS DE PAGO UTILIZADOS")
    fila = _cabecera_tabla(ws, fila, ["Metodo de pago", "Ingreso", "Ventas"])
    for metodo in reporte.get("metodos_pago", []):
        fila = _fila(
            ws,
            fila,
            [metodo["metodo"], metodo["ingreso"], metodo["ventas"]],
            formatos={2: '"$"#,##0.00'},
        )
    fila += 1

    # --- Historial de transacciones (pagina 1) ------------------------------
    fila = _titulo(ws, fila, "HISTORIAL DE TRANSACCIONES")
    fila = _cabecera_tabla(
        ws, fila, ["ID Venta", "Fecha", "Cliente", "Unidades", "Total", "Estado", "Metodo de pago"]
    )
    for t in reporte.get("transacciones", []):
        fecha = t["fecha_venta"]
        fecha_valor = fecha if isinstance(fecha, datetime) else (fecha or "—")
        fila = _fila(
            ws,
            fila,
            [
                t["id_venta"],
                fecha_valor,
                t["cliente"],
                t["total_unidades"],
                t["total_pagado"],
                t["estado"],
                t["metodo_pago"] or "Sin especificar",
            ],
            formatos={2: "dd/mm/yyyy hh:mm", 5: '"$"#,##0.00'},
        )

    # --- Hoja 2: transacciones completas (mas aire) -------------------------
    ws2 = wb.create_sheet("Transacciones")
    _anchos(ws2, {1: 12, 2: 22, 3: 28, 4: 12, 5: 18, 6: 14, 7: 22})
    fila2 = _titulo(ws2, 1, "HISTORIAL DE TRANSACCIONES", ancho=7)
    fila2 = _cabecera_tabla(
        ws2, fila2, ["ID Venta", "Fecha", "Cliente", "Unidades", "Total", "Estado", "Metodo de pago"]
    )
    for t in reporte.get("transacciones", []):
        fecha = t["fecha_venta"]
        fecha_valor = fecha if isinstance(fecha, datetime) else (fecha or "—")
        fila2 = _fila(
            ws2,
            fila2,
            [
                t["id_venta"],
                fecha_valor,
                t["cliente"],
                t["total_unidades"],
                t["total_pagado"],
                t["estado"],
                t["metodo_pago"] or "Sin especificar",
            ],
            formatos={2: "dd/mm/yyyy hh:mm", 5: '"$"#,##0.00'},
        )

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
