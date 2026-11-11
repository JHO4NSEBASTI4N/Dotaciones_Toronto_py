"""Servicio de autenticacion. No importa fastapi: logica pura + SQLAlchemy.

MULTIROL
--------
Un usuario puede tener varios roles y **elegir con cual entra**, igual que el
boton "cambiar rol" del proyecto Java. Al iniciar sesion:

  - si manda `id_rol`, se valida que lo tenga activo y el token sale con ese rol;
  - si no manda nada, se usa su **rol por defecto** (`id_rol_fk`);
  - si no tiene rol por defecto valido, se usa el primero de los que tenga.

Ese rol viaja firmado en el token y es el que autoriza.
"""

from sqlalchemy.orm import Session

from app.core.dependencies import NOMBRES_ROL, roles_asignados
from app.core.exceptions import Conflicto, NoAutorizado, Prohibido, ReglaNegocio
from app.core.security import (
    MINUTOS_EXPIRACION_TOKEN,
    crear_token_acceso,
    verificar_password,
)
from app.models.usuario import Usuario
from app.repositories.usuario import UsuarioRepositorio
from app.schemas.usuario import LoginEntrada, UsuarioCrear


# Se reexporta para que los endpoints de auth tengan una sola puerta de
# entrada al cambio de contrasena (el servicio vive en services/usuario.py).
def cambiar_mi_password(
    sesion: Session, usuario: Usuario, password_actual: str, password_nueva: str
) -> Usuario:
    """Delega en el servicio de usuarios: aqui solo queda el atajo."""
    from app.services.usuario import cambiar_mi_password as _cambiar

    return _cambiar(sesion, usuario, password_actual, password_nueva)


def registrar(sesion: Session, datos: UsuarioCrear) -> Usuario:
    repo = UsuarioRepositorio(sesion)
    if repo.buscar_por_correo(datos.correo):
        raise Conflicto("El correo ya esta registrado")

    usuario = repo.crear(datos)
    sesion.commit()
    sesion.refresh(usuario)
    return usuario


def autenticar(sesion: Session, credenciales: LoginEntrada) -> Usuario:
    repo = UsuarioRepositorio(sesion)
    usuario = repo.buscar_por_correo(credenciales.correo)

    # Mismo mensaje para correo inexistente y contrasena incorrecta:
    # no se revela cual de los dos fallo.
    if usuario is None or not verificar_password(credenciales.password, usuario.password):
        raise NoAutorizado("Correo o contrasena incorrectos")
    if (usuario.estado or "").lower() != "habilitado":
        raise Prohibido("El usuario esta inhabilitado")

    return usuario


def resolver_rol_de_entrada(usuario: Usuario, id_rol: int | None) -> int:
    """Decide con cual rol va a operar el usuario.

    - Si pidio uno concreto, se valida que lo tenga activo.
    - Si no, se usa el de por defecto; si no sirve, el primero de sus roles.
    """
    disponibles = roles_asignados(usuario)
    if not disponibles:
        raise Prohibido(
            "Su usuario no tiene ningun rol activo. Contacte al administrador"
        )

    if id_rol is not None:
        if id_rol not in disponibles:
            raise Prohibido(
                "No tiene asignado el rol solicitado. Roles disponibles: "
                + ", ".join(str(r) for r in sorted(disponibles))
            )
        return id_rol

    if usuario.id_rol_fk in disponibles:
        return usuario.id_rol_fk

    return sorted(disponibles)[0]


def generar_token(usuario: Usuario, id_rol: int) -> dict:
    return {
        "access_token": crear_token_acceso(usuario.id_usuario, id_rol),
        "token_type": "bearer",
        "expira_en_minutos": MINUTOS_EXPIRACION_TOKEN,
        "id_rol": id_rol,
        "nombre_rol": NOMBRES_ROL.get(id_rol),
    }


def iniciar_sesion(sesion: Session, credenciales: LoginEntrada) -> dict:
    """Autentica y emite el token con el rol elegido."""
    usuario = autenticar(sesion, credenciales)
    id_rol = resolver_rol_de_entrada(usuario, credenciales.id_rol)
    return generar_token(usuario, id_rol)


def mis_roles(sesion: Session, usuario: Usuario) -> dict:
    """Los roles con los que este usuario puede entrar (boton 'cambiar rol')."""
    from app.repositories.rol import RolRepositorio

    disponibles = roles_asignados(usuario)
    repo = RolRepositorio(sesion)

    roles = []
    for id_rol in sorted(disponibles):
        rol = repo.buscar_por_id(id_rol)
        roles.append(
            {
                "id_rol": id_rol,
                "nombre_rol": (
                    rol.nombre_rol if rol is not None else NOMBRES_ROL.get(id_rol)
                ),
                "descripcion_rol": rol.descripcion_rol if rol is not None else None,
                "es_por_defecto": usuario.id_rol_fk == id_rol,
            }
        )

    return {
        "id_usuario": usuario.id_usuario,
        "nombre": usuario.nombre,
        "rol_actual": getattr(usuario, "rol_activo", None),
        "roles": roles,
    }


def cambiar_rol(sesion: Session, usuario: Usuario, id_rol: int) -> dict:
    """Emite un token NUEVO con otro de los roles del usuario.

    No cierra la sesion anterior (el token viejo sigue valido hasta que
    expire), pero como cada token lleva su rol firmado, no hay forma de
    saltarse el control cambiando un dato a mano.
    """
    disponibles = roles_asignados(usuario)
    if id_rol not in disponibles:
        raise ReglaNegocio(
            "No puede cambiar a un rol que no tiene asignado. Disponibles: "
            + ", ".join(str(r) for r in sorted(disponibles))
        )

    rol_actual = getattr(usuario, "rol_activo", None)
    if rol_actual == id_rol:
        raise Conflicto("Ya esta operando con ese rol")

    return generar_token(usuario, id_rol)


def listar_usuarios(sesion: Session, saltar: int = 0, limite: int = 50) -> list[Usuario]:
    return UsuarioRepositorio(sesion).listar(saltar=saltar, limite=limite)
