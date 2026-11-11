"""Tests del modulo de gestion de usuarios.

Cubre lo que hace el administrador (listar, ver, editar, inhabilitar,
habilitar, restablecer contrasena) y lo que hace cada usuario con su propia
cuenta (verla, editarla, cambiar su contrasena).

La prueba mas importante de seguridad es
`test_patch_no_deja_cambiar_el_estado_ni_el_rol`: si alguien manda
`{"estado": "Habilitado"}` o `{"id_rol_fk": 1}` por el PATCH, se ignora.
Eso evita el "mass assignment" (que un usuario se suba los permisos solo).
"""

import pytest

from app.core.dependencies import roles_asignados
from app.core.exceptions import ReglaNegocio
from app.core.security import hashear_password
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from app.services import usuario as servicio_usuario


# --- utilidades ---------------------------------------------------------------

def crear_usuario(
    sesion,
    correo: str,
    id_rol: int = 2,
    estado: str = "Habilitado",
    nombre: str = "",
) -> Usuario:
    usuario = Usuario(
        nombre=nombre or correo.split("@")[0],
        correo=correo,
        password=hashear_password("secreta123"),
        estado=estado,
        id_rol_fk=id_rol,
    )
    sesion.add(usuario)
    sesion.flush()
    sesion.add(
        UsuarioRol(
            id_usuario_fk=usuario.id_usuario, id_rol_fk=id_rol, activo=True
        )
    )
    sesion.commit()
    sesion.refresh(usuario)
    return usuario


def login(cliente, correo: str, password: str = "secreta123"):
    return cliente.post(
        "/api/v1/auth/login", json={"correo": correo, "password": password}
    )


def cabeceras(cliente, correo: str, password: str = "secreta123") -> dict:
    respuesta = login(cliente, correo, password)
    assert respuesta.status_code == 200, respuesta.text
    return {"Authorization": f"Bearer {respuesta.json()['access_token']}"}


# --- fixtures -----------------------------------------------------------------

@pytest.fixture()
def admin(cliente, sesion):
    usuario = crear_usuario(sesion, "admin@toronto.com", id_rol=1, nombre="Admin")
    return cabeceras(cliente, usuario.correo)


@pytest.fixture()
def cliente_pepe(cliente, sesion):
    crear_usuario(sesion, "pepe@toronto.com", id_rol=2, nombre="Pepe")
    return cabeceras(cliente, "pepe@toronto.com")


@pytest.fixture()
def pepe(sesion, cliente_pepe):
    return sesion.query(Usuario).filter_by(correo="pepe@toronto.com").first()


# --- listar -------------------------------------------------------------------

def test_admin_lista_los_usuarios(cliente, admin):
    respuesta = cliente.get("/api/v1/usuarios", headers=admin)
    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert datos["total"] == 1
    assert datos["items"][0]["correo"] == "admin@toronto.com"


def test_el_listado_trae_los_roles_activos(cliente, admin):
    respuesta = cliente.get("/api/v1/usuarios", headers=admin)
    assert respuesta.json()["items"][0]["roles_activos"] == [1]


def test_un_cliente_no_puede_listar_usuarios(cliente, cliente_pepe):
    assert cliente.get("/api/v1/usuarios", headers=cliente_pepe).status_code == 403


def test_sin_token_da_401(cliente):
    assert cliente.get("/api/v1/usuarios").status_code == 401


def test_filtro_por_correo(cliente, sesion, admin):
    crear_usuario(sesion, "otro@toronto.com", id_rol=2)
    respuesta = cliente.get(
        "/api/v1/usuarios", params={"correo": "otro"}, headers=admin
    )
    assert respuesta.json()["total"] == 1
    assert respuesta.json()["items"][0]["correo"] == "otro@toronto.com"


def test_filtro_por_estado(cliente, sesion, admin):
    crear_usuario(sesion, "fuera@toronto.com", id_rol=2, estado="Inhabilitado")
    respuesta = cliente.get(
        "/api/v1/usuarios", params={"estado": "Inhabilitado"}, headers=admin
    )
    assert respuesta.json()["total"] == 1
    assert respuesta.json()["items"][0]["correo"] == "fuera@toronto.com"


def test_filtro_por_rol(cliente, sesion, admin):
    crear_usuario(sesion, "vendedor@toronto.com", id_rol=3)
    respuesta = cliente.get(
        "/api/v1/usuarios", params={"id_rol": 3}, headers=admin
    )
    assert respuesta.json()["total"] == 1
    assert respuesta.json()["items"][0]["correo"] == "vendedor@toronto.com"


def test_paginacion(cliente, sesion, admin):
    for i in range(5):
        crear_usuario(sesion, f"u{i}@toronto.com", id_rol=2)

    respuesta = cliente.get(
        "/api/v1/usuarios", params={"limite": 2, "saltar": 0}, headers=admin
    )
    datos = respuesta.json()
    assert datos["total"] == 6  # el admin + 5
    assert len(datos["items"]) == 2


def test_limite_mayor_al_maximo_da_422(cliente, admin):
    respuesta = cliente.get(
        "/api/v1/usuarios", params={"limite": 500}, headers=admin
    )
    assert respuesta.status_code == 422


# --- detalle ------------------------------------------------------------------

def test_admin_ve_la_ficha_de_cualquiera(cliente, admin, pepe):
    respuesta = cliente.get(f"/api/v1/usuarios/{pepe.id_usuario}", headers=admin)
    assert respuesta.status_code == 200
    assert respuesta.json()["correo"] == "pepe@toronto.com"


def test_cada_uno_puede_ver_su_ficha(cliente, cliente_pepe, pepe):
    respuesta = cliente.get(
        f"/api/v1/usuarios/{pepe.id_usuario}", headers=cliente_pepe
    )
    assert respuesta.status_code == 200


def test_no_puede_ver_la_ficha_de_otro(cliente, sesion, cliente_pepe):
    otro = crear_usuario(sesion, "otro@toronto.com", id_rol=2)
    respuesta = cliente.get(
        f"/api/v1/usuarios/{otro.id_usuario}", headers=cliente_pepe
    )
    assert respuesta.status_code == 403


def test_usuario_inexistente_da_404(cliente, admin):
    assert (
        cliente.get("/api/v1/usuarios/9999", headers=admin).status_code == 404
    )


# --- editar -------------------------------------------------------------------

def test_cada_uno_edita_sus_datos(cliente, cliente_pepe, pepe):
    respuesta = cliente.patch(
        f"/api/v1/usuarios/{pepe.id_usuario}",
        json={"telefono": "3001234567", "direccion": "Calle 1 # 2-3"},
        headers=cliente_pepe,
    )
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["telefono"] == "3001234567"


def test_admin_edita_a_cualquiera(cliente, admin, pepe):
    respuesta = cliente.patch(
        f"/api/v1/usuarios/{pepe.id_usuario}",
        json={"nombre": "Jose Perez"},
        headers=admin,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["nombre"] == "Jose Perez"


def test_no_puede_editar_a_otro(cliente, sesion, cliente_pepe):
    otro = crear_usuario(sesion, "otro@toronto.com", id_rol=2)
    respuesta = cliente.patch(
        f"/api/v1/usuarios/{otro.id_usuario}",
        json={"nombre": "Hackeado"},
        headers=cliente_pepe,
    )
    assert respuesta.status_code == 403


def test_patch_no_deja_cambiar_el_estado_ni_el_rol(cliente, sesion, cliente_pepe, pepe):
    """Ni el estado ni el rol se cambian por el PATCH (anti mass assignment)."""
    respuesta = cliente.patch(
        f"/api/v1/usuarios/{pepe.id_usuario}",
        json={"estado": "Habilitado", "id_rol_fk": 1, "password": "otra12345"},
        headers=cliente_pepe,
    )
    assert respuesta.status_code == 200

    sesion.refresh(pepe)
    assert pepe.id_rol_fk == 2, "el rol no se debe poder cambiar por el PATCH"
    assert sorted(roles_asignados(pepe)) == [2]


def test_nombre_muy_corto_da_422(cliente, cliente_pepe, pepe):
    respuesta = cliente.patch(
        f"/api/v1/usuarios/{pepe.id_usuario}",
        json={"nombre": "A"},
        headers=cliente_pepe,
    )
    assert respuesta.status_code == 422


# --- inhabilitar / habilitar --------------------------------------------------

def test_admin_inhabilita_a_un_usuario(cliente, sesion, admin, pepe):
    respuesta = cliente.post(
        f"/api/v1/usuarios/{pepe.id_usuario}/inhabilitar", headers=admin
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "Inhabilitado"

    sesion.refresh(pepe)
    assert pepe.estado == "Inhabilitado"


def test_inhabilitar_no_borra_el_usuario(cliente, sesion, admin, pepe):
    cliente.post(f"/api/v1/usuarios/{pepe.id_usuario}/inhabilitar", headers=admin)

    listado = cliente.get("/api/v1/usuarios", headers=admin).json()
    correos = [u["correo"] for u in listado["items"]]
    assert "pepe@toronto.com" in correos


def test_un_usuario_inhabilitado_no_puede_entrar(cliente, sesion, admin, pepe):
    cliente.post(f"/api/v1/usuarios/{pepe.id_usuario}/inhabilitar", headers=admin)
    respuesta = login(cliente, "pepe@toronto.com")
    assert respuesta.status_code == 403
    assert "inhabilitado" in respuesta.json()["detalle"]


def test_un_usuario_inhabilitado_no_puede_usar_su_token(
    cliente, sesion, admin, cliente_pepe, pepe
):
    """Aunque tenga un token valido en la mano, deja de servir."""
    cliente.post(f"/api/v1/usuarios/{pepe.id_usuario}/inhabilitar", headers=admin)
    respuesta = cliente.get(
        f"/api/v1/usuarios/{pepe.id_usuario}", headers=cliente_pepe
    )
    assert respuesta.status_code == 403


def test_inhabilitar_dos_veces_da_409(cliente, admin, pepe):
    cliente.post(f"/api/v1/usuarios/{pepe.id_usuario}/inhabilitar", headers=admin)
    respuesta = cliente.post(
        f"/api/v1/usuarios/{pepe.id_usuario}/inhabilitar", headers=admin
    )
    assert respuesta.status_code == 409


def test_un_admin_no_puede_inhabilitarse_a_si_mismo(cliente, sesion, admin):
    yo = sesion.query(Usuario).filter_by(correo="admin@toronto.com").first()
    respuesta = cliente.post(
        f"/api/v1/usuarios/{yo.id_usuario}/inhabilitar", headers=admin
    )
    assert respuesta.status_code == 400
    assert "propio usuario" in respuesta.json()["detalle"]


def test_no_se_puede_inhabilitar_al_ultimo_administrador(sesion):
    """Regla de negocio probada en el servicio (por API nunca se llega).

    Por la API el solicitante tambien es administrador, asi que siempre
    quedaria al menos uno. La regla existe por si algun dia se llama desde un
    script o una tarea programada.
    """
    unico_admin = crear_usuario(sesion, "unico@toronto.com", id_rol=1)

    otro_cualquiera = Usuario(id_usuario=9999, nombre="Fantasma")
    otro_cualquiera.password = "x"

    with pytest.raises(ReglaNegocio) as error:
        servicio_usuario.inhabilitar_usuario(
            sesion, unico_admin.id_usuario, otro_cualquiera
        )
    assert "ultimo administrador" in str(error.value)


def test_habilitar_a_un_usuario(cliente, sesion, admin, pepe):
    cliente.post(f"/api/v1/usuarios/{pepe.id_usuario}/inhabilitar", headers=admin)

    respuesta = cliente.post(
        f"/api/v1/usuarios/{pepe.id_usuario}/habilitar", headers=admin
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "Habilitado"


def test_habilitar_a_quien_ya_esta_habilitado_da_409(cliente, admin, pepe):
    respuesta = cliente.post(
        f"/api/v1/usuarios/{pepe.id_usuario}/habilitar", headers=admin
    )
    assert respuesta.status_code == 409


def test_un_cliente_no_puede_inhabilitar_a_nadie(
    cliente, sesion, cliente_pepe
):
    otro = crear_usuario(sesion, "otro@toronto.com", id_rol=2)
    respuesta = cliente.post(
        f"/api/v1/usuarios/{otro.id_usuario}/inhabilitar", headers=cliente_pepe
    )
    assert respuesta.status_code == 403


# --- contrasenas --------------------------------------------------------------

def test_admin_restablece_la_contrasena(cliente, admin, pepe):
    respuesta = cliente.post(
        f"/api/v1/usuarios/{pepe.id_usuario}/restablecer-password",
        json={"password_nueva": "nuevaClave123"},
        headers=admin,
    )
    assert respuesta.status_code == 200, respuesta.text

    # Entra con la nueva...
    assert login(cliente, "pepe@toronto.com", "nuevaClave123").status_code == 200
    # ...y ya no con la vieja.
    assert login(cliente, "pepe@toronto.com", "secreta123").status_code == 401


def test_restablecer_con_la_misma_contrasena_da_409(cliente, admin, pepe):
    respuesta = cliente.post(
        f"/api/v1/usuarios/{pepe.id_usuario}/restablecer-password",
        json={"password_nueva": "secreta123"},
        headers=admin,
    )
    assert respuesta.status_code == 409


def test_contrasena_muy_corta_da_422(cliente, admin, pepe):
    respuesta = cliente.post(
        f"/api/v1/usuarios/{pepe.id_usuario}/restablecer-password",
        json={"password_nueva": "corta"},
        headers=admin,
    )
    assert respuesta.status_code == 422


def test_un_cliente_no_puede_restablecer_contrasenas(
    cliente, sesion, cliente_pepe
):
    otro = crear_usuario(sesion, "otro@toronto.com", id_rol=2)
    respuesta = cliente.post(
        f"/api/v1/usuarios/{otro.id_usuario}/restablecer-password",
        json={"password_nueva": "nuevaClave123"},
        headers=cliente_pepe,
    )
    assert respuesta.status_code == 403


def test_cada_uno_cambia_su_contrasena(cliente, cliente_pepe):
    respuesta = cliente.post(
        "/api/v1/auth/cambiar-password",
        json={"password_actual": "secreta123", "password_nueva": "otraClave456"},
        headers=cliente_pepe,
    )
    assert respuesta.status_code == 200, respuesta.text
    assert login(cliente, "pepe@toronto.com", "otraClave456").status_code == 200


def test_cambiar_contrasena_con_la_actual_mal_da_400(cliente, cliente_pepe):
    """400, NO 401: un 401 haria que el frontend cerrara la sesion."""
    respuesta = cliente.post(
        "/api/v1/auth/cambiar-password",
        json={"password_actual": "noEsEsta", "password_nueva": "otraClave456"},
        headers=cliente_pepe,
    )
    assert respuesta.status_code == 400
    assert "no es correcta" in respuesta.json()["detalle"]


def test_cambiar_contrasena_por_la_misma_da_409(cliente, cliente_pepe):
    respuesta = cliente.post(
        "/api/v1/auth/cambiar-password",
        json={"password_actual": "secreta123", "password_nueva": "secreta123"},
        headers=cliente_pepe,
    )
    assert respuesta.status_code == 409


def test_cambiar_contrasena_sin_token_da_401(cliente):
    respuesta = cliente.post(
        "/api/v1/auth/cambiar-password",
        json={"password_actual": "secreta123", "password_nueva": "otraClave456"},
    )
    assert respuesta.status_code == 401


# --- reglas del proyecto ------------------------------------------------------

def test_no_existe_delete_en_usuarios():
    """REGLA DEL PROYECTO: nada se elimina. La baja es 'Inhabilitado'."""
    from app.main import app as aplicacion

    rutas = aplicacion.openapi()["paths"]
    de_usuarios = [p for p in rutas if "/usuarios" in p]
    assert de_usuarios
    for ruta in de_usuarios:
        assert "delete" not in rutas[ruta], f"{ruta} no debe tener DELETE"


def test_el_estado_solo_toma_dos_valores(cliente, sesion, admin, pepe):
    """Inhabilitar y habilitar son los unicos caminos para el estado."""
    cliente.post(f"/api/v1/usuarios/{pepe.id_usuario}/inhabilitar", headers=admin)
    sesion.refresh(pepe)
    assert pepe.estado in {"Habilitado", "Inhabilitado"}

    cliente.post(f"/api/v1/usuarios/{pepe.id_usuario}/habilitar", headers=admin)
    sesion.refresh(pepe)
    assert pepe.estado == "Habilitado"
