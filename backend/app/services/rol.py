"""Servicio de roles y multirol. Logica pura + SQLAlchemy, sin FastAPI.

Reglas de negocio implementadas aqui:

  1. Un rol no se borra: se **desactiva** (`rol.activo = 0`). Un rol
     desactivado deja de poder usarse para iniciar sesion.
  2. Quitarle un rol a un usuario tampoco lo borra: se pone
     `usuario_rol.activo = 0`, para conservar el historial.
  3. **Todo usuario debe conservar al menos un rol activo.** Si no, no podria
     entrar al sistema. Se valida antes de retirar o desactivar.
  4. El **rol por defecto** (`usuario.id_rol_fk`) se mantiene coherente:
     - al asignar el primer rol, pasa a ser el de por defecto;
     - al retirar el rol de por defecto, se mueve a otro de los que le queden.
  5. No se puede desactivar un rol si dejaria a algun usuario sin ningun rol.
  6. El administrador es el unico que gestiona roles.
"""

from sqlalchemy.orm import Session

from app.core.dependencies import roles_asignados
from app.core.exceptions import Conflicto, NoEncontrado, ReglaNegocio
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.repositories.rol import RolRepositorio
from app.repositories.usuario import UsuarioRepositorio
from app.schemas.rol import AsignacionRol, RolActualizar, RolCrear

ROL_ADMINISTRADOR = 1


def _rol_o_fallar(repo: RolRepositorio, id_rol: int) -> Rol:
    rol = repo.buscar_por_id(id_rol)
    if rol is None:
        raise NoEncontrado(f"No existe el rol con id {id_rol}")
    return rol


def _usuario_o_fallar(repo: UsuarioRepositorio, id_usuario: int) -> Usuario:
    usuario = repo.buscar_por_id(id_usuario)
    if usuario is None:
        raise NoEncontrado(f"No existe el usuario con id {id_usuario}")
    return usuario


def _roles_activos_del_usuario(repo: RolRepositorio, id_usuario: int) -> list[int]:
    return [
        a.id_rol_fk for a in repo.listar_asignaciones(id_usuario) if a.activo
    ]


def _sincronizar_rol_por_defecto(
    repo: RolRepositorio, usuario: Usuario, id_rol_asignado: int | None = None
) -> None:
    """Mantiene `usuario.id_rol_fk` apuntando a un rol que el usuario tenga.

    La columna es la que usa el sistema como "rol con el que entra por defecto".
    Si queda apuntando a un rol retirado, el usuario perderia el acceso o
    entraria con un rol que ya no tiene.
    """
    activos = _roles_activos_del_usuario(repo, usuario.id_usuario)

    if not activos:
        usuario.id_rol_fk = None
        return

    if id_rol_asignado is not None and usuario.id_rol_fk is None:
        usuario.id_rol_fk = id_rol_asignado
        return

    if usuario.id_rol_fk not in activos:
        usuario.id_rol_fk = sorted(activos)[0]


# --- catalogo de roles ---------------------------------------------------------

def listar_roles(sesion: Session, solo_activos: bool = False) -> list[Rol]:
    return RolRepositorio(sesion).listar(solo_activos=solo_activos)


def obtener_rol(sesion: Session, id_rol: int) -> Rol:
    return _rol_o_fallar(RolRepositorio(sesion), id_rol)


def crear_rol(sesion: Session, datos: RolCrear) -> Rol:
    repo = RolRepositorio(sesion)

    if repo.buscar_por_nombre(datos.nombre_rol):
        raise Conflicto(f"Ya existe un rol llamado '{datos.nombre_rol}'")

    rol = repo.crear(
        nombre_rol=datos.nombre_rol, descripcion_rol=datos.descripcion_rol
    )
    sesion.commit()
    sesion.refresh(rol)
    return rol


def actualizar_rol(sesion: Session, id_rol: int, datos: RolActualizar) -> Rol:
    repo = RolRepositorio(sesion)
    rol = _rol_o_fallar(repo, id_rol)

    if datos.nombre_rol is not None:
        existente = repo.buscar_por_nombre(datos.nombre_rol)
        if existente is not None and existente.id_rol != id_rol:
            raise Conflicto(f"Ya existe un rol llamado '{datos.nombre_rol}'")
        rol.nombre_rol = datos.nombre_rol

    if datos.descripcion_rol is not None:
        rol.descripcion_rol = datos.descripcion_rol

    repo.guardar(rol)
    sesion.commit()
    sesion.refresh(rol)
    return rol


def activar_rol(sesion: Session, id_rol: int) -> Rol:
    repo = RolRepositorio(sesion)
    rol = _rol_o_fallar(repo, id_rol)
    if rol.activo:
        raise Conflicto(f"El rol '{rol.nombre_rol}' ya esta activo")
    repo.activar(rol)
    sesion.commit()
    sesion.refresh(rol)
    return rol


def desactivar_rol(sesion: Session, id_rol: int) -> Rol:
    """Baja logica del rol. No borra nada."""
    repo = RolRepositorio(sesion)
    rol = _rol_o_fallar(repo, id_rol)

    if not rol.activo:
        raise Conflicto(f"El rol '{rol.nombre_rol}' ya esta inactivo")

    # Ningun usuario puede quedar sin roles por desactivar un rol.
    for asignacion in _asignaciones_activas_del_rol(repo, id_rol):
        otros = [
            a.id_rol_fk
            for a in repo.listar_asignaciones(asignacion.id_usuario_fk)
            if a.activo and a.id_rol_fk != id_rol
        ]
        if not otros:
            raise ReglaNegocio(
                "No se puede desactivar el rol: el usuario "
                f"{asignacion.id_usuario_fk} quedaria sin ningun rol activo"
            )

    repo.desactivar(rol)
    for asignacion in _asignaciones_activas_del_rol(repo, id_rol):
        repo.desactivar_asignacion(asignacion)
        usuario = repo.sesion.get(Usuario, asignacion.id_usuario_fk)
        if usuario is not None:
            _sincronizar_rol_por_defecto(repo, usuario)

    sesion.commit()
    sesion.refresh(rol)
    return rol


def _asignaciones_activas_del_rol(repo: RolRepositorio, id_rol: int):
    from sqlalchemy import select

    from app.models.usuario_rol import UsuarioRol

    return list(
        repo.sesion.scalars(
            select(UsuarioRol).where(
                UsuarioRol.id_rol_fk == id_rol,
                UsuarioRol.activo == True,  # noqa: E712
            )
        )
    )


# --- roles de un usuario -------------------------------------------------------

def roles_de_usuario(sesion: Session, id_usuario: int) -> dict:
    """Ficha de roles: todos los del catalogo, marcando cuales tiene."""
    repo_rol = RolRepositorio(sesion)
    usuario = _usuario_o_fallar(UsuarioRepositorio(sesion), id_usuario)

    asignados = {a.id_rol_fk: a.activo for a in repo_rol.listar_asignaciones(id_usuario)}
    if usuario.id_rol_fk is not None:
        asignados.setdefault(usuario.id_rol_fk, True)

    roles = []
    for rol in repo_rol.listar():
        activo_asignado = bool(asignados.get(rol.id_rol, False))
        roles.append(
            {
                "id_rol": rol.id_rol,
                "nombre_rol": rol.nombre_rol,
                "descripcion_rol": rol.descripcion_rol,
                "activo": bool(rol.activo),
                "asignado": activo_asignado,
                "es_rol_por_defecto": usuario.id_rol_fk == rol.id_rol,
            }
        )

    return {
        "id_usuario": usuario.id_usuario,
        "nombre": usuario.nombre,
        "correo": usuario.correo,
        "roles": roles,
        "roles_activos": sorted(roles_asignados(usuario)),
    }


def asignar_rol(sesion: Session, id_usuario: int, datos: AsignacionRol) -> dict:
    """El administrador le da un rol nuevo a un usuario."""
    repo = RolRepositorio(sesion)
    usuario = _usuario_o_fallar(UsuarioRepositorio(sesion), id_usuario)
    rol = _rol_o_fallar(repo, datos.id_rol)

    if not rol.activo:
        raise ReglaNegocio(
            f"El rol '{rol.nombre_rol}' esta desactivado y no se puede asignar"
        )

    existente = repo.buscar_asignacion(id_usuario, datos.id_rol)
    if existente is not None:
        if existente.activo:
            raise Conflicto(
                f"El usuario ya tiene el rol '{rol.nombre_rol}'"
            )
        # Ya lo tuvo antes y se le retiro: se reactiva, no se duplica.
        repo.activar_asignacion(existente)
    else:
        repo.crear_asignacion(id_usuario, datos.id_rol)

    _sincronizar_rol_por_defecto(repo, usuario, id_rol_asignado=datos.id_rol)
    sesion.commit()
    sesion.refresh(usuario)
    return roles_de_usuario(sesion, id_usuario)


def retirar_rol(sesion: Session, id_usuario: int, datos: AsignacionRol) -> dict:
    """Le quita un rol a un usuario. Baja logica: activo = 0."""
    repo = RolRepositorio(sesion)
    usuario = _usuario_o_fallar(UsuarioRepositorio(sesion), id_usuario)
    rol = _rol_o_fallar(repo, datos.id_rol)

    asignacion = repo.buscar_asignacion(id_usuario, datos.id_rol)
    if asignacion is None or not asignacion.activo:
        raise NoEncontrado(
            f"El usuario no tiene activo el rol '{rol.nombre_rol}'"
        )

    activos = [
        id_rol
        for id_rol in _roles_activos_del_usuario(repo, id_usuario)
        if id_rol != datos.id_rol
    ]
    # El rol por defecto tambien cuenta como rol activo.
    if usuario.id_rol_fk is not None and usuario.id_rol_fk != datos.id_rol:
        if usuario.id_rol_fk not in activos:
            activos.append(usuario.id_rol_fk)

    if not activos:
        raise ReglaNegocio(
            "No se puede retirar el rol: el usuario quedaria sin ningun rol "
            "activo y no podria volver a iniciar sesion"
        )

    repo.desactivar_asignacion(asignacion)
    if usuario.id_rol_fk == datos.id_rol:
        usuario.id_rol_fk = sorted(activos)[0]

    sesion.commit()
    sesion.refresh(usuario)
    return roles_de_usuario(sesion, id_usuario)
