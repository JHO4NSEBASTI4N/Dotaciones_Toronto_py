"""Pruebas del inicializador del administrador.

Se prueba `asegurar_admin` directamente con la sesión SQLite de las pruebas
(no a través del arranque de FastAPI), que es lo mismo que hace el arranque
real pero sin depender de MySQL.
"""

from sqlalchemy import func, select

from app.core.config import configuracion
from app.core.security import verificar_password
from app.database.inicializador import NOMBRE_ROL_ADMIN, asegurar_admin
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol


def _contar_usuarios(sesion) -> int:
    return sesion.scalar(select(func.count()).select_from(Usuario)) or 0


def test_crea_el_admin_cuando_no_existe(sesion):
    assert _contar_usuarios(sesion) == 0

    creado = asegurar_admin(sesion)

    assert creado is True
    admin = sesion.scalar(
        select(Usuario).where(Usuario.correo == configuracion.admin_correo)
    )
    assert admin is not None
    assert admin.estado == "Habilitado"
    assert admin.nombre == configuracion.admin_nombre
    # La contraseña se guarda hasheada, nunca en texto plano.
    assert admin.password != configuracion.admin_password
    assert verificar_password(configuracion.admin_password, admin.password)


def test_el_admin_puede_entrar_con_su_rol(sesion):
    """Lo que de verdad importa: que el login multirol lo reconozca."""
    asegurar_admin(sesion)

    admin = sesion.scalar(
        select(Usuario).where(Usuario.correo == configuracion.admin_correo)
    )
    rol = sesion.scalar(select(Rol).where(Rol.nombre_rol == NOMBRE_ROL_ADMIN))

    # Columna vieja: el rol por defecto.
    assert admin.id_rol_fk == rol.id_rol

    # Tabla puente: lo que consulta el botón "cambiar rol".
    asignacion = sesion.scalar(
        select(UsuarioRol).where(
            UsuarioRol.id_usuario_fk == admin.id_usuario,
            UsuarioRol.id_rol_fk == rol.id_rol,
        )
    )
    assert asignacion is not None
    assert asignacion.activo is True


def test_no_duplica_ni_resetea_la_clave(sesion):
    """Si el admin ya existe, arrancar otra vez no debe tocarlo."""
    asegurar_admin(sesion)
    admin = sesion.scalar(
        select(Usuario).where(Usuario.correo == configuracion.admin_correo)
    )
    hash_original = admin.password

    # El administrador cambió su contraseña.
    from app.core.security import hashear_password

    admin.password = hashear_password("otraClaveDistinta123")
    sesion.commit()
    hash_nuevo = admin.password

    # Se reinicia el servidor: el inicializador vuelve a correr.
    creado_de_nuevo = asegurar_admin(sesion)

    assert creado_de_nuevo is False
    assert _contar_usuarios(sesion) == 1
    admin = sesion.scalar(
        select(Usuario).where(Usuario.correo == configuracion.admin_correo)
    )
    # La clave que puso el administrador se respeta.
    assert admin.password == hash_nuevo
    assert admin.password != hash_original


def test_no_se_duplica_el_correo_aunque_cambie_la_capitalizacion(sesion):
    asegurar_admin(sesion)
    correo_original = configuracion.admin_correo
    try:
        configuracion.admin_correo = correo_original.upper()
        assert asegurar_admin(sesion) is False
    finally:
        configuracion.admin_correo = correo_original
    assert _contar_usuarios(sesion) == 1


def test_repara_el_rol_si_el_admin_existe_sin_asignacion(sesion):
    """Caso real de la base: usuario que existe pero no puede entrar."""
    rol = Rol(nombre_rol=NOMBRE_ROL_ADMIN, descripcion_rol="Control total", activo=True)
    sesion.add(rol)
    sesion.flush()

    from app.core.security import hashear_password

    # Se deja sin rol por defecto. Ojo: el modelo tiene `default=2` en
    # id_rol_fk, así que al guardar queda 2 (Cliente), no NULL. Justamente el
    # caso que el inicializador tiene que reparar.
    huerfano = Usuario(
        nombre="Administrador",
        correo=configuracion.admin_correo,
        password=hashear_password("claveOriginal123"),
        estado="Habilitado",
        id_rol_fk=2,
    )
    sesion.add(huerfano)
    sesion.commit()

    assert asegurar_admin(sesion) is False  # no lo duplica
    assert _contar_usuarios(sesion) == 1

    sesion.refresh(huerfano)
    assert huerfano.id_rol_fk == rol.id_rol
    asignacion = sesion.scalar(
        select(UsuarioRol).where(
            UsuarioRol.id_usuario_fk == huerfano.id_usuario,
            UsuarioRol.id_rol_fk == rol.id_rol,
        )
    )
    assert asignacion is not None and asignacion.activo is True
    # Y la contraseña original sigue intacta.
    assert verificar_password("claveOriginal123", huerfano.password)


def test_crea_el_rol_administrador_si_la_tabla_esta_vacia(sesion):
    """Base recién creada, sin el catálogo de roles cargado."""
    assert sesion.scalar(select(func.count()).select_from(Rol)) == 0

    assert asegurar_admin(sesion) is True

    rol = sesion.scalar(select(Rol).where(Rol.nombre_rol == NOMBRE_ROL_ADMIN))
    assert rol is not None
    assert rol.activo is True


def test_no_hace_nada_si_la_clave_esta_vacia(sesion):
    clave_original = configuracion.admin_password
    try:
        configuracion.admin_password = ""
        assert asegurar_admin(sesion) is False
    finally:
        configuracion.admin_password = clave_original
    assert _contar_usuarios(sesion) == 0
