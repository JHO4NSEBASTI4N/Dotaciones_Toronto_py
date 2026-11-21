"""Carga administrativa segura desde plantillas Excel."""
from typing import Literal
from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response
from app.core.dependencies import ROL_ADMINISTRADOR, SesionBD, UsuarioActual, requiere_rol
from app.core.exceptions import ReglaNegocio
from app.services import carga_masiva as servicio

router = APIRouter(dependencies=[Depends(requiere_rol(ROL_ADMINISTRADOR))])
Tipo = Literal['productos', 'inventario', 'usuarios']

@router.get('/{tipo}/plantilla')
def descargar_plantilla(tipo: Tipo):
    return Response(servicio.plantilla(tipo), media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', headers={'Content-Disposition': f'attachment; filename=plantilla_{tipo}.xlsx', 'Cache-Control': 'no-store'})

@router.post('/{tipo}')
def cargar(tipo: Tipo, sesion: SesionBD, usuario: UsuarioActual, guardar: bool = False, archivo: UploadFile = File(...)):
    if not (archivo.filename or '').lower().endswith('.xlsx'):
        raise ReglaNegocio('Selecciona un archivo .xlsx.')
    contenido = archivo.file.read(servicio.MAX_ARCHIVO + 1)
    return servicio.procesar(tipo, contenido, sesion, guardar, usuario.nombre)
