"""Servicio de gestion de usuarios. No importa fastapi: logica pura + SQLAlchemy.

Aqui vive lo que hace el ADMINISTRADOR con las cuentas: verlas, editarlas,
inhabilitarlas y restablecerles la contrasena. Y lo que hace cada usuario con
la suya: cambiar su contrasena.

REGLAS DEL PROYECTO QUE SE RESPETAN AQUI
----------------------------------------
1. Nada se borra: el usuario que sale del sistema queda `Inhabilitado`.
2. Un usuario inhabilitado no puede iniciar sesion (lo valida
   `obtener_usuario_actual` y tambien el login).
3. Un administrador no puede inhabilitarse a si mismo: se quedaria por fuera.
4. No se puede inhabilitar al ULTIMO administrador habilitado.
5. El correo no se cambia: es con lo que la persona inicia sesion. Si se
   necesitara, es una operacion aparte con su validacion de duplicados.
"""

from typing import Optional

from sqlalchemy.orm import Session

from app.core.dependencies import ROL_ADMINISTRADOR, roles_asignados
from app.core.exceptions import Conflicto, NoEncontrado, Prohibido, ReglaNegocio
from app.core.security import verificar_password
from app.models.usuario import Usuario
from app.repositories.usuario import UsuarioRepositorio
from app.schemas.usuario import UsuarioActualizar

HABILITADO = "Habilitado"
INHABILITADO = "Inhabilitado"


def _buscar(sesion: Session, id_usuario: int) -> Usuario:
    """Trae el usuario o lanza 404. Se usa en todas las funciones."""
    usuario = UsuarioRepositorio(sesion).buscar_por_id(id_usuario)
    if usuario is None:
        raise NoEncontrado(f"El usuario {id_usuario} no existe")
    return usuario


def _esta_habilitado(usuario: Usuario) -> bool:
    return (usuario.estado or "").lower() == HABILITADO.lower()


def listar_usuarios(
    sesion: Session,
    saltar: int = 0,
    limite: int = 20,
    correo: Optional[str] = None,
    nombre: Optional[str] = None,
    estado: Optional[str] = None,
    id_rol: Optional[int] = None,
) -> tuple[list[Usuario], int]:
    """Listado paginado de usuarios (solo administrador)."""
    return UsuarioRepositorio(sesion).listar_filtrado(
        saltar=saltar,
        limite=limite,
        correo=correo,
        nombre=nombre,
        estado=estado,
        id_rol=id_rol,
    )


def obtener_usuario(sesion: Session, id_usuario: int) -> Usuario:
    return _buscar(sesion, id_usuario)


def roles_de_usuario(usuario: Usuario) -> list[int]:
    """Roles activos del usuario (para mostrarlos en la ficha)."""
    return sorted(roles_asignados(usuario))


def actualizar_usuario(
    sesion: Session,
    id_usuario: int,
    datos: UsuarioActualizar,
    solicitante: Usuario,
) -> Usuario:
    """Edita los datos de contacto de un usuario.

    Lo puede hacer el administrador o el propio usuario. Un usuario normal NO
    puede editarle los datos a otro, ni cambiarse el estado o el rol por aqui:
    eso solo lo hace el administrador con los endpoints de habilitar o de
    roles.
    """
    usuario = _buscar(sesion, id_usuario)

    es_admin = ROL_ADMINISTRADOR in roles_asignados(solicitante)
    if usuario.id_usuario != solicitante.id_usuario and not es_admin:
        raise Prohibido("Solo puede editar sus propios datos")

    repo = UsuarioRepositorio(sesion)
    repo.actualizar(usuario, datos)
    sesion.commit()
    sesion.refresh(usuario)
    return usuario


def inhabilitar_usuario(
    sesion: Session, id_usuario: int, solicitante: Usuario
) -> Usuario:
    """Baja logica: el usuario queda `Inhabilitado` y no puede entrar."""
    usuario = _buscar(sesion, id_usuario)

    if usuario.id_usuario == solicitante.id_usuario:
        raise ReglaNegocio(
            "No puede inhabilitar su propio usuario: perderia el acceso al sistema"
        )

    if not _esta_habilitado(usuario):
        raise Conflicto("El usuario ya estaba inhabilitado")

    repo = UsuarioRepositorio(sesion)

    # Si es administrador y es el ultimo que queda habilitado, no se puede.
    tiene_rol_admin = ROL_ADMINISTRADOR in roles_asignados(usuario)
    if tiene_rol_admin and repo.contar_con_rol_habilitados(ROL_ADMINISTRADOR) <= 1:
        raise ReglaNegocio(
            "No puede inhabilitar al ultimo administrador habilitado del sistema"
        )

    repo.cambiar_estado(usuario, INHABILITADO)
    sesion.commit()
    sesion.refresh(usuario)
    return usuario


def habilitar_usuario(sesion: Session, id_usuario: int) -> Usuario:
    """Vuelve a dejar entrar al usuario."""
    usuario = _buscar(sesion, id_usuario)

    if _esta_habilitado(usuario):
        raise Conflicto("El usuario ya estaba habilitado")

    repo = UsuarioRepositorio(sesion)
    repo.cambiar_estado(usuario, HABILITADO)
    sesion.commit()
    sesion.refresh(usuario)
    return usuario


def restablecer_password(
    sesion: Session, id_usuario: int, password_nueva: str
) -> Usuario:
    """El administrador le pone una contrasena nueva (no sabe la anterior)."""
    usuario = _buscar(sesion, id_usuario)

    if verificar_password(password_nueva, usuario.password or ""):
        raise Conflicto("La contrasena nueva debe ser distinta a la actual")

    repo = UsuarioRepositorio(sesion)
    repo.cambiar_password(usuario, password_nueva)
    sesion.commit()
    sesion.refresh(usuario)
    return usuario


def cambiar_mi_password(
    sesion: Session, usuario: Usuario, password_actual: str, password_nueva: str
) -> Usuario:
    """El propio usuario cambia su contrasena (tiene que saber la actual).

    Se responde 400 (no 401) cuando la actual esta mal, para no confundir al
    frontend: un 401 lo interpretaria como "sesion vencida" y cerraria sesion.
    """
    if not verificar_password(password_actual, usuario.password or ""):
        raise ReglaNegocio("La contrasena actual no es correcta")

    if password_actual == password_nueva:
        raise Conflicto("La contrasena nueva debe ser distinta a la actual")

    repo = UsuarioRepositorio(sesion)
    repo.cambiar_password(usuario, password_nueva)
    sesion.commit()
    sesion.refresh(usuario)
    return usuario
