"""Crea el usuario administrador la primera vez que arranca la aplicación.

Es el equivalente Python del `AdminInitializer.java` del proyecto en Spring
Boot: la aplicación, al iniciar, se asegura de que exista una cuenta de
administrador. Así no hay que crearla a mano en phpMyAdmin antes de poder
entrar al sistema.

DIFERENCIA CON JAVA (importante)
--------------------------------
En Java el rol se guardaba solo en la columna `usuario.id_rol_fk`. Aquí el
sistema es **multirol**, así que un rol se guarda en dos sitios:

  - `usuario.id_rol_fk`  → la columna vieja, que sigue valiendo (rol por
                            defecto, el que se usa si no se elige otro).
  - `usuario_rol`        → la tabla puente, la que de verdad dice "este
                            usuario puede entrar con este rol".

Si se crea el usuario solo con `id_rol_fk`, el login funciona, pero el botón
"cambiar rol" sale vacío. Por eso aquí se escriben las dos.

QUÉ NO HACE
-----------
  - No duplica el usuario: si ya existe el correo, no lo vuelve a crear.
  - No resetea la contraseña en cada arranque (sería un agujero: cualquiera
    que reinicie el servidor devuelve el admin a la clave por defecto).
  - No borra nada (regla del proyecto).
"""

from __future__ import annotations

import logging
import sys

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import configuracion
from app.core.security import hashear_password
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol

# Se configura un logger propio para que los mensajes salgan en la consola de
# uvicorn sin cambiar la configuración global de logging (si se tocara el
# logger raíz, se activarían también los mensajes SQL de SQLAlchemy).
registro = logging.getLogger("dotaciones.inicializador")
if not registro.handlers:
    _manejador = logging.StreamHandler()
    _manejador.setFormatter(logging.Formatter("%(message)s"))
    registro.addHandler(_manejador)
    registro.setLevel(logging.INFO)
    registro.propagate = False

NOMBRE_ROL_ADMIN = "Administrador"


def _obtener_o_crear_rol_admin(sesion: Session) -> Rol:
    """Devuelve el rol Administrador, creándolo si la tabla `rol` está vacía.

    En la base del proyecto el rol 1 ya existe, así que normalmente esto solo
    hace un SELECT. Se contempla el caso de una base recién creada para que el
    arranque no falle.
    """
    rol = sesion.scalar(select(Rol).where(Rol.nombre_rol == NOMBRE_ROL_ADMIN))
    if rol is not None:
        return rol

    rol = Rol(
        nombre_rol=NOMBRE_ROL_ADMIN,
        descripcion_rol="Control total del sistema",
        activo=True,
    )
    sesion.add(rol)
    sesion.flush()
    registro.info("  Rol '%s' no existía: creado con id %s.", NOMBRE_ROL_ADMIN, rol.id_rol)
    return rol


def _tiene_rol(sesion: Session, id_usuario: int, id_rol: int) -> bool:
    """Indica si el usuario ya tiene esa asignación ACTIVA en la tabla puente."""
    asignacion = sesion.scalar(
        select(UsuarioRol).where(
            UsuarioRol.id_usuario_fk == id_usuario,
            UsuarioRol.id_rol_fk == id_rol,
        )
    )
    if asignacion is None:
        return False
    return bool(asignacion.activo)


def asegurar_admin(sesion: Session) -> bool:
    """Crea el administrador si no existe. Devuelve True si lo creó.

    Es idempotente: llamarlo veinte veces deja la base igual que llamarlo una.

    `sesion` es una sesión de SQLAlchemy ya abierta (la que se quiera: la real
    de MySQL, o una de SQLite en las pruebas). Esta función sí hace `commit()`
    porque es una tarea de arranque, no una petición HTTP.
    """
    correo = configuracion.admin_correo.strip()
    if not correo or not configuracion.admin_password:
        registro.warning(
            "  ADMIN_CORREO o ADMIN_PASSWORD están vacíos: no se crea el administrador."
        )
        return False

    rol_admin = _obtener_o_crear_rol_admin(sesion)

    # Se busca sin distinguir mayúsculas: 'Admin@...' y 'admin@...' son la
    # misma cuenta. En MySQL el cotejo por defecto ya lo hace, pero en SQLite
    # (el de las pruebas) no, así que se fuerza con lower().
    existente = sesion.scalar(
        select(Usuario).where(func.lower(Usuario.correo) == correo.lower())
    )

    if existente is not None:
        # --- El usuario ya existe: no se duplica ni se le toca la clave. ---
        reparado = False

        # OJO: no sirve preguntar `if id_rol_fk is None`. El modelo declara
        # `default=2` en esa columna, así que al insertar un usuario sin rol
        # SQLAlchemy le pone 2 (Cliente) y nunca queda NULL. Por eso se compara
        # contra el rol que corresponde: si el admin quedó como Cliente, aquí
        # se corrige para que entre como Administrador.
        if existente.id_rol_fk != rol_admin.id_rol:
            existente.id_rol_fk = rol_admin.id_rol
            reparado = True

        if not _tiene_rol(sesion, existente.id_usuario, rol_admin.id_rol):
            sesion.add(
                UsuarioRol(
                    id_usuario_fk=existente.id_usuario,
                    id_rol_fk=rol_admin.id_rol,
                    activo=True,
                )
            )
            reparado = True

        if reparado:
            sesion.commit()
            registro.info(
                "  El administrador ya existía pero le faltaba el rol: reparado."
            )
        else:
            registro.info(
                "  El administrador ya existe (%s): no se crea de nuevo.", correo
            )
        return False

    # --- No existe: se crea con el rol por defecto Y la fila en usuario_rol. ---
    admin = Usuario(
        nombre=configuracion.admin_nombre,
        documento=configuracion.admin_documento,
        correo=correo,
        telefono=configuracion.admin_telefono,
        password=hashear_password(configuracion.admin_password),
        direccion=configuracion.admin_direccion,
        estado="Habilitado",
        id_rol_fk=rol_admin.id_rol,
    )
    sesion.add(admin)
    sesion.flush()  # hace falta el id para la tabla puente

    sesion.add(
        UsuarioRol(
            id_usuario_fk=admin.id_usuario,
            id_rol_fk=rol_admin.id_rol,
            activo=True,
        )
    )
    sesion.commit()

    registro.info("")
    registro.info("=" * 58)
    registro.info(" Usuario administrador creado automáticamente")
    registro.info(" Correo:     %s", admin.correo)
    registro.info(" Contraseña: %s", configuracion.admin_password)
    registro.info(" (Cámbiala al entrar al sistema la primera vez)")
    registro.info("=" * 58)
    registro.info("")
    return True


def crear_admin_al_arrancar() -> None:
    """Envoltorio que se llama desde el arranque de FastAPI.

    Abre su propia sesión, ejecuta `asegurar_admin` y **nunca deja caer la
    aplicación**: si la base de datos no responde (MySQL apagado, credenciales
    mal puestas), se avisa por consola y el servidor arranca igual. Es mejor
    que el API levante y falle al hacer una consulta, a que no levante y no se
    pueda ni abrir la documentación para diagnosticar.
    """
    if not configuracion.crear_admin_al_iniciar:
        registro.info("  Creación automática del administrador desactivada.")
        return

    # Durante las pruebas (pytest) no se toca la base real: las pruebas crean
    # su propia base SQLite y no deben escribir en MySQL. Se detecta porque
    # pytest está cargado en memoria en el mismo proceso.
    if "pytest" in sys.modules:
        return

    # Import aquí dentro y no arriba para no crear el motor de la base de
    # datos al importar este módulo (importar Python no debe abrir conexiones).
    from app.database.connection import SessionLocal

    sesion = SessionLocal()
    try:
        asegurar_admin(sesion)
    except SQLAlchemyError as error:
        sesion.rollback()
        registro.warning(
            "  No se pudo verificar el administrador (%s).", type(error).__name__
        )
        registro.warning("  El servidor arranca igual; revisa la conexión a MySQL.")
    finally:
        sesion.close()
