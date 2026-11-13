"""Descarga de reportes para el rol Administrador."""

from datetime import datetime
from io import BytesIO
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.core.dependencies import ROL_ADMINISTRADOR, requiere_rol
from app.schemas.reportes import ReporteAdminEntrada
from app.services.reportes import generar_reporte

router = APIRouter()


@router.post(
    "/admin/{formato}",
    dependencies=[Depends(requiere_rol(ROL_ADMINISTRADOR))],
    summary="Descargar un reporte administrativo en Excel o PDF",
)
def descargar_reporte(
    datos: ReporteAdminEntrada,
    formato: Literal["excel", "pdf"],
):
    contenido, tipo_mime = generar_reporte(datos, formato)
    fecha = datetime.now().strftime("%Y%m%d_%H%M")
    extension = "xlsx" if formato == "excel" else "pdf"
    nombre = f"reporte_{datos.modulo}_{fecha}.{extension}"
    return StreamingResponse(
        BytesIO(contenido),
        media_type=tipo_mime,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(nombre)}"},
    )
