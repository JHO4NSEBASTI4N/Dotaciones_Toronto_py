from io import BytesIO

from fastapi.testclient import TestClient
from openpyxl import load_workbook

from app.main import app
from app.schemas.reportes import ReporteAdminEntrada
from app.services.reportes import generar_reporte


REPORTE_PRUEBA = {
    "modulo": "ventas",
    "titulo": "Reporte de ventas de prueba",
    "generado_por": "Administrador de prueba",
    "indicadores": [
        {"etiqueta": "Ingresos", "valor": "$ 120.000"},
        {"etiqueta": "Ventas", "valor": "3"},
        {"etiqueta": "Pedidos", "valor": "5"},
        {"etiqueta": "Bajo mínimo", "valor": "2"},
        {"etiqueta": "Clientes", "valor": "10"},
    ],
    "columnas": [
        {"clave": "mes", "titulo": "Mes"},
        {"clave": "total_cop", "titulo": "Total COP"},
    ],
    "filas": [
        {"mes": "Ene 2026", "total_cop": 120000},
        {"mes": "Feb 2026", "total_cop": 95000},
    ],
    "grafica": {
        "titulo": "Ingresos por mes",
        "tipo": "linea",
        "categorias": ["Ene 2026", "Feb 2026"],
        "series": [{"nombre": "Ingresos COP", "valores": [120000, 95000]}],
    },
}


def test_reporte_excel_contiene_datos_y_grafica_editable():
    reporte = ReporteAdminEntrada.model_validate(REPORTE_PRUEBA)
    contenido, mime = generar_reporte(reporte, "excel")

    libro = load_workbook(BytesIO(contenido))
    assert mime == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert libro.sheetnames == ["Resumen", "Datos de gráfica", "Datos"]
    assert len(libro["Resumen"]._charts) == 1
    assert libro["Datos"].max_row == 3
    assert libro["Datos"]["B2"].value == 120000


def test_reporte_pdf_incluye_documento_pdf():
    reporte = ReporteAdminEntrada.model_validate(REPORTE_PRUEBA)
    contenido, mime = generar_reporte(reporte, "pdf")

    assert mime == "application/pdf"
    assert contenido.startswith(b"%PDF-")
    assert len(contenido) > 1000


def test_endpoint_reportes_exige_autenticacion():
    cliente = TestClient(app)
    respuesta = cliente.post("/api/v1/reportes/admin/excel", json=REPORTE_PRUEBA)
    assert respuesta.status_code == 401


def test_reporte_rechaza_series_con_longitud_incorrecta():
    datos = {**REPORTE_PRUEBA, "grafica": {**REPORTE_PRUEBA["grafica"], "series": [{"nombre": "Ingresos", "valores": [1]}]}}
    try:
        ReporteAdminEntrada.model_validate(datos)
    except ValueError as error:
        assert "Cada serie debe tener" in str(error)
    else:
        raise AssertionError("Se esperaba rechazo por serie incompleta")
