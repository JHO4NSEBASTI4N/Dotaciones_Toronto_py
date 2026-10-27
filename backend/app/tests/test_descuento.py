"""Tests del modulo de descuentos (catalogo).

Cubre: listado y filtros, creacion con validaciones, un solo activo por
producto, PATCH parcial, activar/desactivar y el calculo del precio final
que reutilizara el modulo de pedidos.
"""

from decimal import Decimal

import pytest

from app.core.security import hashear_password
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol


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
def producto(cliente, cabeceras_admin):
    """Camisa de 30.000 (precio base para todos los calculos)."""
    respuesta = cliente.post(
        "/api/v1/productos",
        json={"nombre": "Camisa", "precio": "30000.00"},
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


@pytest.fixture()
def producto_dos(cliente, cabeceras_admin):
    respuesta = cliente.post(
        "/api/v1/productos",
        json={"nombre": "Casco", "precio": "50000.00"},
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


@pytest.fixture()
def descuento_porcentaje(cliente, cabeceras_admin, producto):
    respuesta = cliente.post(
        "/api/v1/descuentos",
        json={
            "id_producto_fk": producto["id_producto"],
            "tipo_descuento": "PORCENTAJE",
            "valor_descuento": "10.00",
        },
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


# --- listado y consulta ------------------------------------------------------

def test_listar_vacio(cliente):
    respuesta = cliente.get("/api/v1/descuentos")
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["total"] == 0
    assert cuerpo["items"] == []
    assert cuerpo["limite"] == 20


def test_listar_devuelve_el_descuento(cliente, descuento_porcentaje):
    cuerpo = cliente.get("/api/v1/descuentos").json()
    assert cuerpo["total"] == 1
    assert cuerpo["items"][0]["tipo_descuento"] == "PORCENTAJE"
    assert cuerpo["items"][0]["valor_descuento"] == "10.00"
    assert cuerpo["items"][0]["activo"] is True


def test_listar_no_expone_campos_internos(cliente, descuento_porcentaje):
    campos = set(cliente.get("/api/v1/descuentos").json()["items"][0])
    assert campos == {
        "id_descuento", "id_producto_fk", "tipo_descuento",
        "valor_descuento", "activo",
    }


def test_filtro_por_producto(cliente, descuento_porcentaje, producto_dos):
    assert cliente.get(
        f"/api/v1/descuentos?id_producto={descuento_porcentaje['id_producto_fk']}"
    ).json()["total"] == 1

    assert cliente.get(
        f"/api/v1/descuentos?id_producto={producto_dos['id_producto']}"
    ).json()["total"] == 0


def test_filtro_por_tipo_y_activo(cliente, descuento_porcentaje):
    assert cliente.get("/api/v1/descuentos?tipo_descuento=FIJO").json()["total"] == 0
    assert cliente.get("/api/v1/descuentos?tipo_descuento=PORCENTAJE").json()["total"] == 1
    assert cliente.get("/api/v1/descuentos?activo=true").json()["total"] == 1
    assert cliente.get("/api/v1/descuentos?activo=false").json()["total"] == 0


def test_detalle_existente(cliente, descuento_porcentaje):
    respuesta = cliente.get(f"/api/v1/descuentos/{descuento_porcentaje['id_descuento']}")
    assert respuesta.status_code == 200
    assert respuesta.json()["id_descuento"] == descuento_porcentaje["id_descuento"]


def test_detalle_inexistente_da_404(cliente):
    assert cliente.get("/api/v1/descuentos/9999").status_code == 404


def test_paginacion(cliente, cabeceras_admin, producto, producto_dos):
    for producto_actual, valor in ((producto, "10.00"), (producto_dos, "20.00")):
        cliente.post(
            "/api/v1/descuentos",
            json={
                "id_producto_fk": producto_actual["id_producto"],
                "tipo_descuento": "PORCENTAJE",
                "valor_descuento": valor,
            },
            headers=cabeceras_admin,
        )
    cuerpo = cliente.get("/api/v1/descuentos?saltar=1&limite=1").json()
    assert cuerpo["total"] == 2
    assert len(cuerpo["items"]) == 1
    assert cuerpo["saltar"] == 1


def test_limite_mayor_al_maximo_da_422(cliente):
    assert cliente.get("/api/v1/descuentos?limite=500").status_code == 422


# --- creacion y validaciones -------------------------------------------------

def test_crear_porcentaje(descuento_porcentaje, producto):
    assert descuento_porcentaje["id_producto_fk"] == producto["id_producto"]
    assert descuento_porcentaje["activo"] is True


def test_crear_fijo(cliente, cabeceras_admin, producto):
    respuesta = cliente.post(
        "/api/v1/descuentos",
        json={
            "id_producto_fk": producto["id_producto"],
            "tipo_descuento": "FIJO",
            "valor_descuento": "5000.00",
        },
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 201
    assert respuesta.json()["tipo_descuento"] == "FIJO"


def test_crear_sin_token_da_401(cliente, producto):
    respuesta = cliente.post(
        "/api/v1/descuentos",
        json={
            "id_producto_fk": producto["id_producto"],
            "tipo_descuento": "PORCENTAJE",
            "valor_descuento": "10.00",
        },
    )
    assert respuesta.status_code == 401


def test_crear_con_rol_cliente_da_403(cliente, cabeceras_cliente, producto):
    respuesta = cliente.post(
        "/api/v1/descuentos",
        json={
            "id_producto_fk": producto["id_producto"],
            "tipo_descuento": "PORCENTAJE",
            "valor_descuento": "10.00",
        },
        headers=cabeceras_cliente,
    )
    assert respuesta.status_code == 403


def test_tipo_invalido_da_422(cliente, cabeceras_admin, producto):
    respuesta = cliente.post(
        "/api/v1/descuentos",
        json={
            "id_producto_fk": producto["id_producto"],
            "tipo_descuento": "REGALO",
            "valor_descuento": "10.00",
        },
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 422


def test_porcentaje_mayor_a_100_da_422(cliente, cabeceras_admin, producto):
    respuesta = cliente.post(
        "/api/v1/descuentos",
        json={
            "id_producto_fk": producto["id_producto"],
            "tipo_descuento": "PORCENTAJE",
            "valor_descuento": "150.00",
        },
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 422


def test_valor_cero_da_422(cliente, cabeceras_admin, producto):
    respuesta = cliente.post(
        "/api/v1/descuentos",
        json={
            "id_producto_fk": producto["id_producto"],
            "tipo_descuento": "PORCENTAJE",
            "valor_descuento": "0",
        },
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 422


def test_fijo_mayor_al_precio_da_400(cliente, cabeceras_admin, producto):
    respuesta = cliente.post(
        "/api/v1/descuentos",
        json={
            "id_producto_fk": producto["id_producto"],
            "tipo_descuento": "FIJO",
            "valor_descuento": "40000.00",
        },
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 400
    assert "no puede superar el precio" in respuesta.json()["detalle"]


def test_producto_inexistente_da_404(cliente, cabeceras_admin):
    respuesta = cliente.post(
        "/api/v1/descuentos",
        json={
            "id_producto_fk": 9999,
            "tipo_descuento": "PORCENTAJE",
            "valor_descuento": "10.00",
        },
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 404


def test_producto_inhabilitado_da_400(cliente, cabeceras_admin, producto):
    cliente.post(
        f"/api/v1/productos/{producto['id_producto']}/inhabilitar",
        headers=cabeceras_admin,
    )
    respuesta = cliente.post(
        "/api/v1/descuentos",
        json={
            "id_producto_fk": producto["id_producto"],
            "tipo_descuento": "PORCENTAJE",
            "valor_descuento": "10.00",
        },
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 400
    assert "inhabilitado" in respuesta.json()["detalle"]


# --- un solo activo por producto --------------------------------------------

def test_crear_segundo_apaga_el_primero(
    cliente, cabeceras_admin, producto, descuento_porcentaje
):
    respuesta = cliente.post(
        "/api/v1/descuentos",
        json={
            "id_producto_fk": producto["id_producto"],
            "tipo_descuento": "FIJO",
            "valor_descuento": "3000.00",
        },
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 201

    vigentes = cliente.get(
        f"/api/v1/descuentos?id_producto={producto['id_producto']}&activo=true"
    ).json()
    assert vigentes["total"] == 1
    assert vigentes["items"][0]["id_descuento"] == respuesta.json()["id_descuento"]

    # El primero no se borro: sigue en la tabla, inactivo.
    todos = cliente.get(
        f"/api/v1/descuentos?id_producto={producto['id_producto']}"
    ).json()
    assert todos["total"] == 2


# --- PATCH parcial -----------------------------------------------------------

def test_actualizar_valor(cliente, cabeceras_admin, descuento_porcentaje):
    respuesta = cliente.patch(
        f"/api/v1/descuentos/{descuento_porcentaje['id_descuento']}",
        json={"valor_descuento": "25.00"},
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["valor_descuento"] == "25.00"
    assert respuesta.json()["tipo_descuento"] == "PORCENTAJE"


def test_actualizar_sin_campos_da_400(cliente, cabeceras_admin, descuento_porcentaje):
    respuesta = cliente.patch(
        f"/api/v1/descuentos/{descuento_porcentaje['id_descuento']}",
        json={},
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 400


def test_actualizar_a_porcentaje_invalido_da_400(
    cliente, cabeceras_admin, descuento_porcentaje
):
    respuesta = cliente.patch(
        f"/api/v1/descuentos/{descuento_porcentaje['id_descuento']}",
        json={"valor_descuento": "120.00"},
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 400


def test_actualizar_cambiando_tipo_revalida_el_valor(
    cliente, cabeceras_admin, producto, descuento_porcentaje
):
    """30% sobre 30.000 son 9.000; como FIJO tambien es valido (<= 30.000)."""
    respuesta = cliente.patch(
        f"/api/v1/descuentos/{descuento_porcentaje['id_descuento']}",
        json={"tipo_descuento": "FIJO"},
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["tipo_descuento"] == "FIJO"


def test_actualizar_a_fijo_mayor_al_precio_da_400(
    cliente, cabeceras_admin, producto
):
    creado = cliente.post(
        "/api/v1/descuentos",
        json={
            "id_producto_fk": producto["id_producto"],
            "tipo_descuento": "PORCENTAJE",
            "valor_descuento": "10.00",
        },
        headers=cabeceras_admin,
    ).json()
    respuesta = cliente.patch(
        f"/api/v1/descuentos/{creado['id_descuento']}",
        json={"tipo_descuento": "FIJO", "valor_descuento": "99000.00"},
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 400


def test_actualizar_inexistente_da_404(cliente, cabeceras_admin):
    respuesta = cliente.patch(
        "/api/v1/descuentos/9999",
        json={"valor_descuento": "5.00"},
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 404


# --- desactivar / activar (no hay DELETE) -----------------------------------

def test_desactivar_no_borra(cliente, cabeceras_admin, descuento_porcentaje):
    respuesta = cliente.post(
        f"/api/v1/descuentos/{descuento_porcentaje['id_descuento']}/desactivar",
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["activo"] is False

    # Sigue existiendo y se puede consultar.
    assert cliente.get(
        f"/api/v1/descuentos/{descuento_porcentaje['id_descuento']}"
    ).status_code == 200


def test_desactivar_dos_veces_da_409(cliente, cabeceras_admin, descuento_porcentaje):
    cliente.post(
        f"/api/v1/descuentos/{descuento_porcentaje['id_descuento']}/desactivar",
        headers=cabeceras_admin,
    )
    respuesta = cliente.post(
        f"/api/v1/descuentos/{descuento_porcentaje['id_descuento']}/desactivar",
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 409


def test_activar_apaga_el_vigente(
    cliente, cabeceras_admin, producto, descuento_porcentaje
):
    segundo = cliente.post(
        "/api/v1/descuentos",
        json={
            "id_producto_fk": producto["id_producto"],
            "tipo_descuento": "FIJO",
            "valor_descuento": "2000.00",
        },
        headers=cabeceras_admin,
    ).json()

    respuesta = cliente.post(
        f"/api/v1/descuentos/{descuento_porcentaje['id_descuento']}/activar",
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["activo"] is True

    vigentes = cliente.get(
        f"/api/v1/descuentos?id_producto={producto['id_producto']}&activo=true"
    ).json()
    assert vigentes["total"] == 1
    assert vigentes["items"][0]["id_descuento"] == descuento_porcentaje["id_descuento"]

    # El segundo quedo inactivo, no borrado.
    assert cliente.get(f"/api/v1/descuentos/{segundo['id_descuento']}").json()["activo"] is False


def test_activar_uno_ya_activo_da_409(
    cliente, cabeceras_admin, descuento_porcentaje
):
    respuesta = cliente.post(
        f"/api/v1/descuentos/{descuento_porcentaje['id_descuento']}/activar",
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 409


def test_desactivar_sin_token_da_401(cliente, descuento_porcentaje):
    respuesta = cliente.post(
        f"/api/v1/descuentos/{descuento_porcentaje['id_descuento']}/desactivar"
    )
    assert respuesta.status_code == 401


# --- precio vigente de un producto ------------------------------------------

def test_vigente_calcula_porcentaje(
    cliente, producto, descuento_porcentaje
):
    respuesta = cliente.get(f"/api/v1/descuentos/producto/{producto['id_producto']}")
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["precio_lista"] == "30000.00"
    assert cuerpo["descuento_unitario"] == "3000.00"
    assert cuerpo["precio_unitario"] == "27000.00"


def test_vigente_calcula_fijo(cliente, cabeceras_admin, producto):
    cliente.post(
        "/api/v1/descuentos",
        json={
            "id_producto_fk": producto["id_producto"],
            "tipo_descuento": "FIJO",
            "valor_descuento": "4500.00",
        },
        headers=cabeceras_admin,
    )
    cuerpo = cliente.get(f"/api/v1/descuentos/producto/{producto['id_producto']}").json()
    assert cuerpo["descuento_unitario"] == "4500.00"
    assert cuerpo["precio_unitario"] == "25500.00"


def test_vigente_sin_descuento_da_404(cliente, producto):
    respuesta = cliente.get(f"/api/v1/descuentos/producto/{producto['id_producto']}")
    assert respuesta.status_code == 404


def test_vigente_ignora_el_descuento_desactivado(
    cliente, cabeceras_admin, producto, descuento_porcentaje
):
    cliente.post(
        f"/api/v1/descuentos/{descuento_porcentaje['id_descuento']}/desactivar",
        headers=cabeceras_admin,
    )
    respuesta = cliente.get(f"/api/v1/descuentos/producto/{producto['id_producto']}")
    assert respuesta.status_code == 404


def test_vigente_de_producto_inexistente_da_404(cliente):
    assert cliente.get("/api/v1/descuentos/producto/9999").status_code == 404


# --- funcion pura: calcular_precio_final ------------------------------------

def test_calcular_precio_final_sin_descuento():
    from app.services.descuento import calcular_precio_final

    lista, rebaja, final = calcular_precio_final(Decimal("19990.50"), None)
    assert (lista, rebaja, final) == (
        Decimal("19990.50"),
        Decimal("0.00"),
        Decimal("19990.50"),
    )


class _DescuentoFalso:
    """Doble minimo, para probar la funcion pura sin tocar la BD."""

    def __init__(self, tipo, valor, activo=True):
        self.tipo_descuento = tipo
        self.valor_descuento = Decimal(valor)
        self.activo = activo


def test_calcular_precio_final_porcentaje_redondea_a_centavos():
    from app.services.descuento import calcular_precio_final

    lista, rebaja, final = calcular_precio_final(
        Decimal("33333.33"), _DescuentoFalso("PORCENTAJE", "33.33")
    )
    assert lista == Decimal("33333.33")
    assert rebaja == Decimal("11110.00")   # 11109.998889 -> 11110.00
    assert final == Decimal("22223.33")


def test_calcular_precio_final_nunca_queda_negativo():
    from app.services.descuento import calcular_precio_final

    lista, rebaja, final = calcular_precio_final(
        Decimal("1000.00"), _DescuentoFalso("FIJO", "5000.00")
    )
    assert rebaja == Decimal("1000.00")
    assert final == Decimal("0.00")


def test_calcular_precio_final_ignora_descuento_inactivo():
    from app.services.descuento import calcular_precio_final

    _, rebaja, final = calcular_precio_final(
        Decimal("1000.00"), _DescuentoFalso("PORCENTAJE", "50", activo=False)
    )
    assert rebaja == Decimal("0.00")
    assert final == Decimal("1000.00")
