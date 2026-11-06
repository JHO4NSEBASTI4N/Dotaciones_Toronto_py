"""Tests del modulo de roles y del inicio de sesion MULTIROL.

Cubre: catalogo de roles (crear, editar, activar, desactivar), asignacion y
retiro de roles por parte del administrador, y el flujo del boton "cambiar
rol": el usuario ve sus roles, elige uno y entra con ese rol.

La prueba clave del multirol es
`test_con_rol_vendedor_no_puede_administrar`: el mismo usuario, con el mismo
token de sesion pero entrando como Vendedor, NO puede hacer cosas de
administrador. Eso es lo que diferencia multirol de tener permisos sumados.
"""

import pytest

from app.core.security import hashear_password
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol


# --- utilidades ---------------------------------------------------------------

def crear_rol(sesion, id_rol: int, nombre: str, activo: bool = True) -> Rol:
    rol = Rol(
        id_rol=id_rol,
        nombre_rol=nombre,
        descripcion_rol=f"Rol {nombre}",
        activo=activo,
    )
    sesion.add(rol)
    sesion.commit()
    return rol


def crear_usuario(sesion, correo: str, roles: list[int], por_defecto: int | None = None):
    """Crea un usuario con VARIOS roles activos."""
    usuario = Usuario(
        nombre=correo.split("@")[0],
        correo=correo,
        password=hashear_password("secreta123"),
        estado="Habilitado",
        id_rol_fk=por_defecto if por_defecto is not None else (roles[0] if roles else None),
    )
    sesion.add(usuario)
    sesion.flush()
    for id_rol in roles:
        sesion.add(
            UsuarioRol(
                id_usuario_fk=usuario.id_usuario,
                id_rol_fk=id_rol,
                activo=True,
            )
        )
    sesion.commit()
    sesion.refresh(usuario)
    return usuario


def login(cliente, correo: str, id_rol: int | None = None):
    cuerpo = {"correo": correo, "password": "secreta123"}
    if id_rol is not None:
        cuerpo["id_rol"] = id_rol
    return cliente.post("/api/v1/auth/login", json=cuerpo)


def cabeceras(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# --- fixtures -----------------------------------------------------------------

@pytest.fixture()
def catalogo(sesion):
    """Los 4 roles que trae la base."""
    crear_rol(sesion, 1, "Administrador")
    crear_rol(sesion, 2, "Cliente")
    crear_rol(sesion, 3, "Vendedor")
    crear_rol(sesion, 4, "Bodeguero")


@pytest.fixture()
def admin(cliente, sesion, catalogo):
    """Administrador puro (solo rol 1)."""
    crear_usuario(sesion, "admin@toronto.com", [1], por_defecto=1)
    return cabeceras(login(cliente, "admin@toronto.com").json()["access_token"])


@pytest.fixture()
def multi(cliente, sesion, catalogo):
    """Usuario con DOS roles: Administrador y Vendedor.

    Es el caso del dump (usuario 12 tiene los roles 1 y 3).
    """
    crear_usuario(
        sesion, "multi@toronto.com", [1, 3], por_defecto=1
    )
    return "multi@toronto.com"


@pytest.fixture()
def cliente_simple(cliente, sesion, catalogo):
    crear_usuario(sesion, "pepe@toronto.com", [2], por_defecto=2)
    return "pepe@toronto.com"


# --- catalogo de roles --------------------------------------------------------

def test_admin_lista_los_roles(cliente, admin):
    respuesta = cliente.get("/api/v1/roles", headers=admin)
    assert respuesta.status_code == 200
    assert len(respuesta.json()) == 4
    assert respuesta.json()[0]["nombre_rol"] == "Administrador"


def test_cliente_no_ve_el_catalogo(cliente, cliente_simple):
    cab = cabeceras(login(cliente, cliente_simple).json()["access_token"])
    respuesta = cliente.get("/api/v1/roles", headers=cab)
    assert respuesta.status_code == 403


def test_sin_token_da_401(cliente):
    assert cliente.get("/api/v1/roles").status_code == 401


def test_admin_crea_un_rol(cliente, admin):
    respuesta = cliente.post(
        "/api/v1/roles",
        json={"nombre_rol": "Auditor", "descripcion_rol": "Solo consulta"},
        headers=admin,
    )
    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.json()["nombre_rol"] == "Auditor"
    assert respuesta.json()["activo"] is True


def test_no_se_pueden_repetir_roles(cliente, admin):
    respuesta = cliente.post(
        "/api/v1/roles", json={"nombre_rol": "Cliente"}, headers=admin
    )
    assert respuesta.status_code == 409


def test_nombre_de_rol_muy_corto_da_422(cliente, admin):
    respuesta = cliente.post(
        "/api/v1/roles", json={"nombre_rol": "ab"}, headers=admin
    )
    assert respuesta.status_code == 422


def test_admin_edita_un_rol(cliente, admin):
    respuesta = cliente.patch(
        "/api/v1/roles/4",
        json={"descripcion_rol": "Maneja bodega y despachos"},
        headers=admin,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["descripcion_rol"] == "Maneja bodega y despachos"


def test_rol_inexistente_da_404(cliente, admin):
    assert cliente.get("/api/v1/roles/99", headers=admin).status_code == 404


def test_desactivar_y_reactivar_un_rol(cliente, sesion, admin):
    """Baja logica: el rol no desaparece, queda inactivo."""
    desactivado = cliente.post("/api/v1/roles/4/desactivar", headers=admin)
    assert desactivado.status_code == 200
    assert desactivado.json()["activo"] is False

    # Sigue existiendo en el catalogo.
    assert cliente.get("/api/v1/roles/4", headers=admin).status_code == 200

    reactivado = cliente.post("/api/v1/roles/4/activar", headers=admin)
    assert reactivado.status_code == 200
    assert reactivado.json()["activo"] is True


def test_no_se_puede_desactivar_dos_veces(cliente, admin):
    cliente.post("/api/v1/roles/4/desactivar", headers=admin)
    respuesta = cliente.post("/api/v1/roles/4/desactivar", headers=admin)
    assert respuesta.status_code == 409


def test_no_se_puede_desactivar_si_deja_a_alguien_sin_roles(
    cliente, sesion, catalogo, admin
):
    crear_usuario(sesion, "bodega@toronto.com", [4], por_defecto=4)
    respuesta = cliente.post("/api/v1/roles/4/desactivar", headers=admin)
    assert respuesta.status_code == 400
    assert "sin ningun rol activo" in respuesta.json()["detalle"]


# --- asignar y retirar roles --------------------------------------------------

def test_admin_asigna_un_rol(cliente, sesion, catalogo, admin):
    usuario = crear_usuario(sesion, "nuevo@toronto.com", [2], por_defecto=2)
    respuesta = cliente.post(
        f"/api/v1/roles/usuario/{usuario.id_usuario}/asignar",
        json={"id_rol": 3},
        headers=admin,
    )
    assert respuesta.status_code == 200, respuesta.text
    assert set(respuesta.json()["roles_activos"]) == {2, 3}


def test_no_se_puede_asignar_un_rol_que_ya_tiene(cliente, sesion, catalogo, admin):
    usuario = crear_usuario(sesion, "nuevo@toronto.com", [2], por_defecto=2)
    respuesta = cliente.post(
        f"/api/v1/roles/usuario/{usuario.id_usuario}/asignar",
        json={"id_rol": 2},
        headers=admin,
    )
    assert respuesta.status_code == 409


def test_no_se_puede_asignar_un_rol_desactivado(cliente, sesion, catalogo, admin):
    crear_rol(sesion, 9, "Temporal", activo=False)
    usuario = crear_usuario(sesion, "nuevo@toronto.com", [2], por_defecto=2)
    respuesta = cliente.post(
        f"/api/v1/roles/usuario/{usuario.id_usuario}/asignar",
        json={"id_rol": 9},
        headers=admin,
    )
    assert respuesta.status_code == 400


def test_asignar_un_rol_retirado_lo_reactiva(cliente, sesion, catalogo, admin):
    """No duplica la fila de usuario_rol: reactiva la que ya existia."""
    usuario = crear_usuario(sesion, "nuevo@toronto.com", [2], por_defecto=2)
    asignar = {"id_rol": 3}
    cliente.post(
        f"/api/v1/roles/usuario/{usuario.id_usuario}/asignar",
        json=asignar, headers=admin,
    )
    cliente.post(
        f"/api/v1/roles/usuario/{usuario.id_usuario}/retirar",
        json=asignar, headers=admin,
    )
    respuesta = cliente.post(
        f"/api/v1/roles/usuario/{usuario.id_usuario}/asignar",
        json=asignar, headers=admin,
    )
    assert respuesta.status_code == 200
    assert 3 in respuesta.json()["roles_activos"]

    # Solo existe UNA fila para (usuario, rol 3).
    filas = [
        a for a in sesion.query(UsuarioRol).filter_by(
            id_usuario_fk=usuario.id_usuario, id_rol_fk=3
        )
    ]
    assert len(filas) == 1


def test_admin_retira_un_rol(cliente, sesion, catalogo, admin):
    usuario = crear_usuario(sesion, "nuevo@toronto.com", [2, 3], por_defecto=2)
    respuesta = cliente.post(
        f"/api/v1/roles/usuario/{usuario.id_usuario}/retirar",
        json={"id_rol": 3},
        headers=admin,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["roles_activos"] == [2]


def test_no_se_puede_retirar_el_ultimo_rol(cliente, sesion, catalogo, admin):
    usuario = crear_usuario(sesion, "solo@toronto.com", [2], por_defecto=2)
    respuesta = cliente.post(
        f"/api/v1/roles/usuario/{usuario.id_usuario}/retirar",
        json={"id_rol": 2},
        headers=admin,
    )
    assert respuesta.status_code == 400
    assert "sin ningun rol activo" in respuesta.json()["detalle"]


def test_retirar_el_rol_por_defecto_mueve_el_defecto(cliente, sesion, catalogo, admin):
    usuario = crear_usuario(sesion, "nuevo@toronto.com", [2, 3], por_defecto=2)
    cliente.post(
        f"/api/v1/roles/usuario/{usuario.id_usuario}/retirar",
        json={"id_rol": 2}, headers=admin,
    )
    sesion.refresh(usuario)
    assert usuario.id_rol_fk == 3


def test_retirar_un_rol_que_no_tiene_da_404(cliente, sesion, catalogo, admin):
    usuario = crear_usuario(sesion, "nuevo@toronto.com", [2], por_defecto=2)
    respuesta = cliente.post(
        f"/api/v1/roles/usuario/{usuario.id_usuario}/retirar",
        json={"id_rol": 4}, headers=admin,
    )
    assert respuesta.status_code == 404


def test_cliente_no_puede_asignar_roles(cliente, sesion, catalogo, cliente_simple):
    cab = cabeceras(login(cliente, cliente_simple).json()["access_token"])
    usuario = sesion.query(Usuario).filter_by(correo="pepe@toronto.com").first()
    respuesta = cliente.post(
        f"/api/v1/roles/usuario/{usuario.id_usuario}/asignar",
        json={"id_rol": 1}, headers=cab,
    )
    assert respuesta.status_code == 403


def test_cliente_no_puede_autoasignarse_administrador(
    cliente, sesion, catalogo, cliente_simple
):
    """La prueba de seguridad mas importante del modulo."""
    cab = cabeceras(login(cliente, cliente_simple).json()["access_token"])
    suyo = sesion.query(Usuario).filter_by(correo="pepe@toronto.com").first()
    respuesta = cliente.post(
        f"/api/v1/roles/usuario/{suyo.id_usuario}/asignar",
        json={"id_rol": 1}, headers=cab,
    )
    assert respuesta.status_code == 403
    sesion.refresh(suyo)
    assert sorted(__import__("app.core.dependencies", fromlist=["roles_asignados"]).roles_asignados(suyo)) == [2]


# --- MULTIROL: mis-roles y cambiar-rol ---------------------------------------

def test_mis_roles_muestra_los_dos_roles(cliente, multi):
    cab = cabeceras(login(cliente, multi).json()["access_token"])
    respuesta = cliente.get("/api/v1/auth/mis-roles", headers=cab)
    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert len(datos["roles"]) == 2
    assert {r["id_rol"] for r in datos["roles"]} == {1, 3}
    assert datos["rol_actual"] == 1


def test_login_sin_rol_usa_el_de_por_defecto(cliente, multi):
    respuesta = login(cliente, multi)
    assert respuesta.status_code == 200
    assert respuesta.json()["id_rol"] == 1
    assert respuesta.json()["nombre_rol"] == "Administrador"


def test_login_eligiendo_rol(cliente, multi):
    respuesta = login(cliente, multi, id_rol=3)
    assert respuesta.status_code == 200
    assert respuesta.json()["id_rol"] == 3
    assert respuesta.json()["nombre_rol"] == "Vendedor"


def test_login_con_un_rol_que_no_tiene_da_403(cliente, multi):
    respuesta = login(cliente, multi, id_rol=4)
    assert respuesta.status_code == 403
    assert "No tiene asignado el rol solicitado" in respuesta.json()["detalle"]


def test_cambiar_rol_devuelve_un_token_nuevo(cliente, multi):
    cab = cabeceras(login(cliente, multi).json()["access_token"])
    respuesta = cliente.post(
        "/api/v1/auth/cambiar-rol", json={"id_rol": 3}, headers=cab
    )
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["id_rol"] == 3
    assert respuesta.json()["access_token"] != cab["Authorization"].split()[1]


def test_cambiar_a_un_rol_que_no_tiene_da_400(cliente, multi):
    cab = cabeceras(login(cliente, multi).json()["access_token"])
    respuesta = cliente.post(
        "/api/v1/auth/cambiar-rol", json={"id_rol": 4}, headers=cab
    )
    assert respuesta.status_code == 400


def test_cambiar_al_mismo_rol_da_409(cliente, multi):
    cab = cabeceras(login(cliente, multi).json()["access_token"])
    respuesta = cliente.post(
        "/api/v1/auth/cambiar-rol", json={"id_rol": 1}, headers=cab
    )
    assert respuesta.status_code == 409


# --- LA PRUEBA CLAVE: el rol activo restringe --------------------------------

def test_con_rol_vendedor_no_puede_administrar(cliente, multi):
    """Mismo usuario, mismo sistema: entrando como Vendedor NO administra."""
    # Entrando como Administrador, si puede.
    admin_cab = cabeceras(login(cliente, multi, id_rol=1).json()["access_token"])
    assert cliente.get("/api/v1/roles", headers=admin_cab).status_code == 200

    # Entrando como Vendedor, NO.
    vendedor_cab = cabeceras(login(cliente, multi, id_rol=3).json()["access_token"])
    respuesta = cliente.get("/api/v1/roles", headers=vendedor_cab)
    assert respuesta.status_code == 403
    assert "rol con el que inicio sesion" in respuesta.json()["detalle"]


def test_con_rol_administrador_si_puede_administrar(cliente, multi):
    cab = cabeceras(login(cliente, multi, id_rol=1).json()["access_token"])
    assert cliente.get("/api/v1/roles", headers=cab).status_code == 200


def test_al_retirarle_el_rol_el_token_viejo_deja_de_servir(
    cliente, sesion, catalogo, admin, multi
):
    """Si el admin le quita el rol, el token que ya tenia con ese rol muere."""
    cab_vendedor = cabeceras(login(cliente, multi, id_rol=3).json()["access_token"])
    # Con el rol 3 funciona el endpoint de vender (listar ventas).
    assert cliente.get("/api/v1/ventas", headers=cab_vendedor).status_code == 200

    usuario = sesion.query(Usuario).filter_by(correo=multi).first()
    cliente.post(
        f"/api/v1/roles/usuario/{usuario.id_usuario}/retirar",
        json={"id_rol": 3}, headers=admin,
    )

    # El mismo token ya no vale: el rol le fue retirado.
    respuesta = cliente.get("/api/v1/ventas", headers=cab_vendedor)
    assert respuesta.status_code == 403
    assert "ya no esta asignado" in respuesta.json()["detalle"]


def test_usuario_puede_ver_sus_propios_roles(cliente, sesion, catalogo, multi):
    cab = cabeceras(login(cliente, multi).json()["access_token"])
    usuario = sesion.query(Usuario).filter_by(correo=multi).first()
    respuesta = cliente.get(
        f"/api/v1/roles/usuario/{usuario.id_usuario}", headers=cab
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["id_usuario"] == usuario.id_usuario


def test_no_puede_ver_roles_de_otro(cliente, sesion, catalogo, multi, cliente_simple):
    cab = cabeceras(login(cliente, cliente_simple).json()["access_token"])
    otro = sesion.query(Usuario).filter_by(correo=multi).first()
    respuesta = cliente.get(f"/api/v1/roles/usuario/{otro.id_usuario}", headers=cab)
    assert respuesta.status_code == 403


def test_usuario_sin_roles_no_puede_entrar(cliente, sesion, catalogo):
    """Sin ningun rol activo no hay con que operar: 403."""
    usuario = crear_usuario(sesion, "sinrol@toronto.com", [2], por_defecto=2)
    # Se le quita la asignacion y se le deja sin rol por defecto.
    # (No se puede crear con id_rol_fk=None: el modelo tiene default=2.)
    sesion.query(UsuarioRol).filter_by(id_usuario_fk=usuario.id_usuario).delete()
    usuario.id_rol_fk = None
    sesion.commit()

    respuesta = login(cliente, "sinrol@toronto.com")
    assert respuesta.status_code == 403
    assert "ningun rol activo" in respuesta.json()["detalle"]


# --- reglas del proyecto ------------------------------------------------------

def test_no_existe_delete_en_roles(cliente):
    """REGLA DEL PROYECTO: nada se elimina. Los roles se desactivan."""
    from app.main import app as aplicacion

    rutas = aplicacion.openapi()["paths"]
    de_roles = [p for p in rutas if "/roles" in p]
    assert de_roles
    for ruta in de_roles:
        assert "delete" not in rutas[ruta], f"{ruta} no debe tener DELETE"
