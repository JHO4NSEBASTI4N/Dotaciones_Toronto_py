import pytest

from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from app.core.security import hashear_password


def crear_usuario_con_rol(sesion, correo: str, id_rol: int) -> Usuario:
    """Helper: crea un usuario y le asigna un rol (sin pasar por la API)."""
    usuario = Usuario(
        nombre=correo.split("@")[0],
        correo=correo,
        password=hashear_password("secreta123"),
        estado="Habilitado",
    )
    sesion.add(usuario)
    sesion.flush()
    sesion.add(UsuarioRol(id_usuario_fk=usuario.id_usuario, id_rol_fk=id_rol))
    sesion.commit()
    sesion.refresh(usuario)
    return usuario


def token_de(cliente, correo: str) -> dict:
    respuesta = cliente.post(
        "/api/v1/auth/login", json={"correo": correo, "password": "secreta123"}
    )
    assert respuesta.status_code == 200, respuesta.text
    return {"Authorization": f"Bearer {respuesta.json()['access_token']}"}


@pytest.fixture()
def cabeceras_admin(cliente, sesion):
    crear_usuario_con_rol(sesion, "admin@toronto.com", 1)
    return token_de(cliente, "admin@toronto.com")


@pytest.fixture()
def cabeceras_cliente(cliente, sesion):
    crear_usuario_con_rol(sesion, "cliente@toronto.com", 2)
    return token_de(cliente, "cliente@toronto.com")


@pytest.fixture()
def producto_creado(cliente, cabeceras_admin):
    respuesta = cliente.post(
        "/api/v1/productos",
        json={
            "nombre": "Camisa",
            "precio": "30000.00",
            "talla": "M",
            "color": "Rojo",
            "categoria": "Camisas/Polos",
        },
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


# --- listado publico ---------------------------------------------------------

def test_listar_vacio(cliente):
    respuesta = cliente.get("/api/v1/productos")
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["total"] == 0
    assert cuerpo["items"] == []
    assert cuerpo["limite"] == 20


def test_listar_devuelve_paginacion(cliente, producto_creado):
    respuesta = cliente.get("/api/v1/productos")
    cuerpo = respuesta.json()
    assert cuerpo["total"] == 1
    assert cuerpo["items"][0]["nombre"] == "Camisa"
    assert cuerpo["items"][0]["precio"] == "30000.00"


def test_listar_no_expone_campos_internos(cliente, producto_creado):
    campos = set(cliente.get("/api/v1/productos").json()["items"][0])
    assert campos == {
        "id_producto", "nombre", "precio", "talla", "color", "imagen",
        "categoria", "estado", "inhabilitado",
    }


def test_paginacion_limite_y_saltar(cliente, cabeceras_admin):
    for nombre in ("Uno", "Dos", "Tres"):
        cliente.post(
            "/api/v1/productos",
            json={"nombre": nombre, "precio": "1000.00"},
            headers=cabeceras_admin,
        )
    cuerpo = cliente.get("/api/v1/productos?saltar=1&limite=1").json()
    assert cuerpo["total"] == 3
    assert len(cuerpo["items"]) == 1
    assert cuerpo["saltar"] == 1


def test_limite_mayor_al_maximo_da_422(cliente):
    assert cliente.get("/api/v1/productos?limite=500").status_code == 422


def test_filtro_por_nombre(cliente, cabeceras_admin, producto_creado):
    cliente.post(
        "/api/v1/productos",
        json={"nombre": "Casco", "precio": "20000.00"},
        headers=cabeceras_admin,
    )
    cuerpo = cliente.get("/api/v1/productos?nombre=cami").json()
    assert cuerpo["total"] == 1
    assert cuerpo["items"][0]["nombre"] == "Camisa"


def test_filtro_por_categoria(cliente, producto_creado):
    cuerpo = cliente.get("/api/v1/productos?categoria=Camisas/Polos").json()
    assert cuerpo["total"] == 1
    assert cliente.get("/api/v1/productos?categoria=Calzado").json()["total"] == 0


# --- detalle -----------------------------------------------------------------

def test_detalle_existente(cliente, producto_creado):
    respuesta = cliente.get(f"/api/v1/productos/{producto_creado['id_producto']}")
    assert respuesta.status_code == 200
    assert respuesta.json()["nombre"] == "Camisa"


def test_detalle_inexistente_da_404(cliente):
    respuesta = cliente.get("/api/v1/productos/999999")
    assert respuesta.status_code == 404
    assert respuesta.json()["error"] == "NoEncontrado"


# --- permisos ----------------------------------------------------------------

def test_crear_sin_token_da_401(cliente):
    respuesta = cliente.post("/api/v1/productos", json={"nombre": "X", "precio": "1"})
    assert respuesta.status_code == 401


def test_crear_como_cliente_da_403(cliente, cabeceras_cliente):
    respuesta = cliente.post(
        "/api/v1/productos",
        json={"nombre": "Camisa", "precio": "30000.00"},
        headers=cabeceras_cliente,
    )
    assert respuesta.status_code == 403
    assert respuesta.json()["error"] == "Prohibido"


# --- creacion ----------------------------------------------------------------

def test_crear_asigna_estado_y_habilitado(cliente, cabeceras_admin, producto_creado):
    assert producto_creado["estado"] == "Disponible"
    assert producto_creado["inhabilitado"] is False
    assert producto_creado["categoria"] == "Camisas/Polos"


def test_crear_nombre_duplicado_da_409(cliente, cabeceras_admin, producto_creado):
    respuesta = cliente.post(
        "/api/v1/productos",
        json={"nombre": producto_creado["nombre"], "precio": "1000.00"},
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 409


def test_crear_precio_negativo_da_422(cliente, cabeceras_admin):
    respuesta = cliente.post(
        "/api/v1/productos",
        json={"nombre": "Malo", "precio": "-5"},
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 422


def test_crear_no_permite_fijar_inhabilitado(cliente, cabeceras_admin):
    """Mass assignment: el cliente no decide estado ni inhabilitado."""
    respuesta = cliente.post(
        "/api/v1/productos",
        json={"nombre": "Nuevo", "precio": "1000.00", "inhabilitado": True,
              "estado": "Inhabilitado"},
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 201
    assert respuesta.json()["inhabilitado"] is False
    assert respuesta.json()["estado"] == "Disponible"


# --- actualizacion -----------------------------------------------------------

def test_actualizar_parcial(cliente, cabeceras_admin, producto_creado):
    respuesta = cliente.patch(
        f"/api/v1/productos/{producto_creado['id_producto']}",
        json={"precio": "35000.00"},
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["precio"] == "35000.00"
    assert respuesta.json()["nombre"] == "Camisa"


def test_actualizar_sin_campos_da_400(cliente, cabeceras_admin, producto_creado):
    respuesta = cliente.patch(
        f"/api/v1/productos/{producto_creado['id_producto']}",
        json={},
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 400


def test_actualizar_a_nombre_existente_da_409(cliente, cabeceras_admin, producto_creado):
    otro = cliente.post(
        "/api/v1/productos",
        json={"nombre": "Casco", "precio": "20000.00"},
        headers=cabeceras_admin,
    ).json()
    respuesta = cliente.patch(
        f"/api/v1/productos/{otro['id_producto']}",
        json={"nombre": producto_creado["nombre"]},
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 409


# --- borrado logico ----------------------------------------------------------

def test_inhabilitar_oculta_el_producto_sin_borrarlo(
    cliente, cabeceras_admin, producto_creado
):
    url = f"/api/v1/productos/{producto_creado['id_producto']}"
    r = cliente.post(f"{url}/inhabilitar", headers=cabeceras_admin)
    assert r.status_code == 200
    assert r.json()["inhabilitado"] is True
    assert r.json()["estado"] == "Inhabilitado"

    # desaparece del listado publico...
    assert cliente.get("/api/v1/productos").json()["total"] == 0
    # ...pero SIGUE EXISTIENDO y es consultable
    assert cliente.get("/api/v1/productos?incluir_inhabilitados=true").json()["total"] == 1
    assert cliente.get(url).status_code == 200


def test_inhabilitar_dos_veces_da_409(cliente, cabeceras_admin, producto_creado):
    url = f"/api/v1/productos/{producto_creado['id_producto']}/inhabilitar"
    cliente.post(url, headers=cabeceras_admin)
    assert cliente.post(url, headers=cabeceras_admin).status_code == 409


def test_habilitar_revierte_la_inhabilitacion(cliente, cabeceras_admin, producto_creado):
    url = f"/api/v1/productos/{producto_creado['id_producto']}"
    cliente.post(f"{url}/inhabilitar", headers=cabeceras_admin)
    respuesta = cliente.post(f"{url}/habilitar", headers=cabeceras_admin)
    assert respuesta.status_code == 200
    assert respuesta.json()["inhabilitado"] is False
    assert cliente.get("/api/v1/productos").json()["total"] == 1


# --- REGLA DEL PROYECTO: nada se elimina ------------------------------------
# Este test se rompe a proposito si alguien agrega un endpoint DELETE.

def test_la_api_no_expone_ningun_endpoint_delete():
    from app.main import app as aplicacion

    operaciones_prohibidas = [
        (metodo.upper(), ruta)
        for ruta, operaciones in aplicacion.openapi()["paths"].items()
        for metodo in operaciones
        if metodo.lower() == "delete"
    ]
    assert operaciones_prohibidas == [], (
        "Regla del proyecto: no se elimina informacion. "
        f"Endpoints DELETE encontrados: {operaciones_prohibidas}"
    )