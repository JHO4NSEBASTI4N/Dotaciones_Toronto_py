from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from app.core.dependencies import ROL_ADMINISTRADOR, ROL_VENDEDOR, SesionBD, UsuarioActual, requiere_rol, roles_de
from app.core.exceptions import NoEncontrado, Prohibido
from app.core.pagination import PaginaRespuesta, ParametrosPaginacion
from app.schemas.pedido import PedidoEstadoActualizar, PedidoRespuesta
from app.services import pedido as servicio
router = APIRouter()
PuedeGestionar = Depends(requiere_rol(ROL_ADMINISTRADOR, ROL_VENDEDOR))
ROLES_QUE_VEN_TODO = {ROL_ADMINISTRADOR, ROL_VENDEDOR}

def _es_staff(usuario) -> bool:
    return bool(roles_de(usuario) & ROLES_QUE_VEN_TODO)

@router.get('', response_model=PaginaRespuesta[PedidoRespuesta])
def listar(sesion: SesionBD, usuario: UsuarioActual, paginacion: ParametrosPaginacion=Depends(), estado: Optional[str]=Query(None, description='Pendiente, Enviado, Entregado o Cancelado'), id_usuario: Optional[int]=Query(None, description='Solo administrador/vendedor'), incluir_ocultos: Optional[bool]=Query(None, description='Por defecto el cliente no ve los entregados')):
    staff = _es_staff(usuario)
    filtro_usuario = id_usuario if staff else usuario.id_usuario
    if incluir_ocultos is None:
        incluir_ocultos = staff
    items, total = servicio.listar_pedidos(sesion, saltar=paginacion.saltar, limite=paginacion.limite, id_usuario=filtro_usuario, estado=estado, incluir_ocultos=incluir_ocultos)
    return PaginaRespuesta[PedidoRespuesta](total=total, saltar=paginacion.saltar, limite=paginacion.limite, items=[PedidoRespuesta.model_validate(p) for p in items])

@router.get('/{id_pedido}', response_model=PedidoRespuesta)
def detalle(id_pedido: int, sesion: SesionBD, usuario: UsuarioActual):
    if not _es_staff(usuario) and (not servicio.es_del_usuario(sesion, id_pedido, usuario.id_usuario)):
        raise NoEncontrado(f'No existe el pedido con id {id_pedido}')
    return servicio.obtener_pedido(sesion, id_pedido)

@router.post('', response_model=PedidoRespuesta, status_code=status.HTTP_201_CREATED)
def crear(sesion: SesionBD, usuario: UsuarioActual):
    return servicio.crear_desde_carrito(sesion, usuario.id_usuario)

@router.patch('/{id_pedido}/estado', response_model=PedidoRespuesta, dependencies=[PuedeGestionar])
def cambiar_estado(id_pedido: int, datos: PedidoEstadoActualizar, sesion: SesionBD, usuario: UsuarioActual):
    return servicio.cambiar_estado(sesion, id_pedido, datos.estado, usuario_responsable=usuario.nombre)

@router.post('/{id_pedido}/cancelar', response_model=PedidoRespuesta)
def cancelar(id_pedido: int, sesion: SesionBD, usuario: UsuarioActual):
    if not _es_staff(usuario):
        if not servicio.es_cancelable_por_cliente(sesion, id_pedido, usuario.id_usuario):
            if not servicio.es_del_usuario(sesion, id_pedido, usuario.id_usuario):
                raise NoEncontrado(f'No existe el pedido con id {id_pedido}')
            raise Prohibido('Solo puede cancelar sus pedidos mientras esten en estado Pendiente')
    return servicio.cancelar_pedido(sesion, id_pedido, usuario_responsable=usuario.nombre)
