"""Carga segura desde plantillas Excel según el rol y el tipo de datos."""
from typing import Literal
from fastapi import APIRouter, File, UploadFile
from fastapi.responses import Response
from app.core.dependencies import (
    ROL_ADMINISTRADOR, ROL_BODEGUERO, SesionBD, UsuarioActual, roles_de,
)
from app.core.exceptions import Prohibido, ReglaNegocio
from app.services import carga_masiva as servicio

router = APIRouter()
Tipo = Literal['productos', 'inventario', 'usuarios']


def autorizar_carga(tipo: Tipo, usuario: UsuarioActual):
    # El rol activo del token es el que manda, también para usuarios multirrol.
    permitidos = {ROL_ADMINISTRADOR}
    if tipo == 'inventario':
        permitidos.add(ROL_BODEGUERO)
    if not roles_de(usuario) & permitidos:
        raise Prohibido('No tiene permisos para esta carga con el rol activo.')


@router.get('/{tipo}/plantilla')
def descargar_plantilla(tipo: Tipo, usuario: UsuarioActual):
    autorizar_carga(tipo, usuario)
    return Response(servicio.plantilla(tipo), media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', headers={'Content-Disposition': f'attachment; filename=plantilla_{tipo}.xlsx', 'Cache-Control': 'no-store'})

@router.post('/{tipo}')
def cargar(tipo: Tipo, sesion: SesionBD, usuario: UsuarioActual, guardar: bool = False, archivo: UploadFile = File(...)):
    autorizar_carga(tipo, usuario)
    if not (archivo.filename or '').lower().endswith('.xlsx'):
        raise ReglaNegocio('Selecciona un archivo .xlsx.')
    contenido = archivo.file.read(servicio.MAX_ARCHIVO + 1)
    return servicio.procesar(tipo, contenido, sesion, guardar, usuario.nombre)
