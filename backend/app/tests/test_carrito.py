"""Tests del modulo de carrito.

Cubre: carrito por usuario, acumulacion de lineas, precio con descuento
vigente, validacion de stock, baja logica (no DELETE) y aislamiento entre
usuarios.
"""

import pytest

from app.core.security import hashear_password
from app.models.inventario import Inventario
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol


def crear_usuario(sesion, correo: str, id_rol: int = 2) -> Usuario:
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
    crear_usuario(sesion, "admin@toronto.com", id_rol=1)
    return token_de(cliente, "admin@toronto.com")


@pytest.fixture()
def cabeceras_cliente(cliente, sesion):
    crear_usuario(sesion, "cliente@toronto.com", id_rol=2)
    return token_de(cliente, "cliente@toronto.com")


@pytest.fixture()
def cabeceras_otro(cliente, sesion):
    crear_usuario(sesion, "otro@toronto.com", id_rol=2)
    return token_de(cliente, "otro@toronto.com")


@pytest.fixture()
def producto(cliente, cabeceras_admin):
    """Camisa de 30.000 con 10 unidades en inventario."""
    respuesta = cliente.post(
        "/api/v1/productos",
        json={"nombre": "Camisa", "precio": "30000.00", "talla": "M", "color": "Rojo"},
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 201, respuesta.text
    creado = respuesta.json()
    cliente.post(
        "/api/v1/inventario",
        json={
            "id_producto_fk": creado["id_producto"],
            "cantidad_actual": 10,
            "stock_minimo": 2,
        },
        headers=cabeceras_admin,
    )
    return creado


@pytest.fixture()
def producto_sin_inventario(cliente, cabeceras_admin):
    respuesta = cliente.post(
        "/api/v1/productos",
        json={"nombre": "Casco", "precio": "20000.00"},
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


# --- carrito vacio -----------------------------------------------------------

def test_carrito_recien_creado_esta_vacio(cliente, cabeceras_cliente):
    respuesta = cliente.get("/api/v1/carrito", headers=cabeceras_cliente)
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["items"] == []
    assert cuerpo["total_unidades"] == 0
    assert cuerpo["total"] == "0.00"
    assert cuerpo["id_carrito"] > 0


def test_ver_carrito_sin_token_da_401(cliente):
    assert cliente.get("/api/v1/carrito").status_code == 401


def test_pide_el_mismo_carrito_dos_veces(cliente, cabeceras_cliente):
    primero = cliente.get("/api/v1/carrito", headers=cabeceras_cliente).json()
    segundo = cliente.get("/api/v1/carrito", headers=cabeceras_cliente).json()
    assert primero["id_carrito"] == segundo["id_carrito"]


# --- agregar -----------------------------------------------------------------

def test_agregar_producto(cliente, cabeceras_cliente, producto):
    respuesta = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 2},
        headers=cabeceras_cliente,
    )
    assert respuesta.status_code == 201, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["total_unidades"] == 2
    assert cuerpo["items"][0]["nombre"] == "Camisa"
    assert cuerpo["items"][0]["cantidad"] == 2
    assert cuerpo["items"][0]["precio_unitario"] == "30000.00"
    assert cuerpo["items"][0]["subtotal"] == "60000.00"
    assert cuerpo["total"] == "60000.00"


def test_agregar_sin_cantidad_usa_uno(cliente, cabeceras_cliente, producto):
    cuerpo = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"]},
        headers=cabeceras_cliente,
    ).json()
    assert cuerpo["items"][0]["cantidad"] == 1


def test_agregar_dos_veces_acumula_en_la_misma_linea(
    cliente, cabeceras_cliente, producto
):
    cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 2},
        headers=cabeceras_cliente,
    )
    cuerpo = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 3},
        headers=cabeceras_cliente,
    ).json()
    assert len(cuerpo["items"]) == 1
    assert cuerpo["items"][0]["cantidad"] == 5
    assert cuerpo["total_unidades"] == 5


def test_dos_productos_distintos(cliente, cabeceras_cliente, producto, producto_sin_inventario):
    for producto_actual in (producto, producto_sin_inventario):
        cliente.post(
            "/api/v1/carrito/items",
            json={"id_producto": producto_actual["id_producto"], "cantidad": 1},
            headers=cabeceras_cliente,
        )
    cuerpo = cliente.get("/api/v1/carrito", headers=cabeceras_cliente).json()
    assert len(cuerpo["items"]) == 2
    assert cuerpo["total"] == "50000.00"


def test_agregar_producto_inexistente_da_404(cliente, cabeceras_cliente):
    respuesta = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": 9999, "cantidad": 1},
        headers=cabeceras_cliente,
    )
    assert respuesta.status_code == 404


def test_agregar_producto_inhabilitado_da_400(
    cliente, cabeceras_admin, cabeceras_cliente, producto
):
    cliente.post(
        f"/api/v1/productos/{producto['id_producto']}/inhabilitar",
        headers=cabeceras_admin,
    )
    respuesta = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 1},
        headers=cabeceras_cliente,
    )
    assert respuesta.status_code == 400
    assert "inhabilitado" in respuesta.json()["detalle"]


def test_cantidad_cero_da_422(cliente, cabeceras_cliente, producto):
    respuesta = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 0},
        headers=cabeceras_cliente,
    )
    assert respuesta.status_code == 422


def test_cantidad_negativa_da_422(cliente, cabeceras_cliente, producto):
    respuesta = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": -3},
        headers=cabeceras_cliente,
    )
    assert respuesta.status_code == 422


def test_agregar_sin_token_da_401(cliente, producto):
    respuesta = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 1},
    )
    assert respuesta.status_code == 401


# --- stock -------------------------------------------------------------------

def test_no_puede_pedir_mas_que_el_stock(cliente, cabeceras_cliente, producto):
    respuesta = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 11},
        headers=cabeceras_cliente,
    )
    assert respuesta.status_code == 400
    assert "Stock insuficiente" in respuesta.json()["detalle"]
    assert "10" in respuesta.json()["detalle"]


def test_puede_pedir_exactamente_el_stock(cliente, cabeceras_cliente, producto):
    respuesta = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 10},
        headers=cabeceras_cliente,
    )
    assert respuesta.status_code == 201
    assert respuesta.json()["items"][0]["stock_disponible"] == 10


def test_acumular_valida_el_total(cliente, cabeceras_cliente, producto):
    cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 6},
        headers=cabeceras_cliente,
    )
    respuesta = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 6},
        headers=cabeceras_cliente,
    )
    assert respuesta.status_code == 400


def test_producto_sin_inventario_no_valida_stock(
    cliente, cabeceras_cliente, producto_sin_inventario
):
    respuesta = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto_sin_inventario["id_producto"], "cantidad": 50},
        headers=cabeceras_cliente,
    )
    assert respuesta.status_code == 201
    assert respuesta.json()["items"][0]["stock_disponible"] is None


def test_stock_se_suma_entre_filas(
    cliente, cabeceras_admin, cabeceras_cliente, producto, sesion
):
    """Dos filas de inventario del mismo producto: el stock es la suma."""
    sesion.add(
        Inventario(
            id_producto_fk=producto["id_producto"], cantidad_actual=5, stock_minimo=1
        )
    )
    sesion.commit()
    cuerpo = cliente.get("/api/v1/carrito", headers=cabeceras_cliente).json()
    # Sin lineas todavia; se comprueba por el POST que el limite sea 15.
    respuesta = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 15},
        headers=cabeceras_cliente,
    )
    assert respuesta.status_code == 201, cuerpo
    assert respuesta.json()["items"][0]["stock_disponible"] == 15


# --- precio con descuento ----------------------------------------------------

def test_precio_con_descuento_porcentaje(
    cliente, cabeceras_admin, cabeceras_cliente, producto
):
    cliente.post(
        "/api/v1/descuentos",
        json={
            "id_producto_fk": producto["id_producto"],
            "tipo_descuento": "PORCENTAJE",
            "valor_descuento": "10.00",
        },
        headers=cabeceras_admin,
    )
    cuerpo = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 2},
        headers=cabeceras_cliente,
    ).json()

    item = cuerpo["items"][0]
    assert item["precio_lista"] == "30000.00"
    assert item["descuento_unitario"] == "3000.00"
    assert item["precio_unitario"] == "27000.00"
    assert item["subtotal_lista"] == "60000.00"
    assert item["descuento_total"] == "6000.00"
    assert item["subtotal"] == "54000.00"
    assert cuerpo["subtotal_lista"] == "60000.00"
    assert cuerpo["descuento_total"] == "6000.00"
    assert cuerpo["total"] == "54000.00"


def test_precio_con_descuento_fijo(
    cliente, cabeceras_admin, cabeceras_cliente, producto
):
    cliente.post(
        "/api/v1/descuentos",
        json={
            "id_producto_fk": producto["id_producto"],
            "tipo_descuento": "FIJO",
            "valor_descuento": "5000.00",
        },
        headers=cabeceras_admin,
    )
    cuerpo = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 1},
        headers=cabeceras_cliente,
    ).json()
    assert cuerpo["items"][0]["precio_unitario"] == "25000.00"


def test_descuento_nuevo_se_refleja_sin_tocar_el_carrito(
    cliente, cabeceras_admin, cabeceras_cliente, producto
):
    """El precio se recalcula al leer: un descuento posterior cambia el total."""
    cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 1},
        headers=cabeceras_cliente,
    )
    assert cliente.get("/api/v1/carrito", headers=cabeceras_cliente).json()["total"] == "30000.00"

    cliente.post(
        "/api/v1/descuentos",
        json={
            "id_producto_fk": producto["id_producto"],
            "tipo_descuento": "PORCENTAJE",
            "valor_descuento": "50.00",
        },
        headers=cabeceras_admin,
    )
    assert cliente.get("/api/v1/carrito", headers=cabeceras_cliente).json()["total"] == "15000.00"


def test_descuento_desactivado_vuelve_al_precio_de_lista(
    cliente, cabeceras_admin, cabeceras_cliente, producto
):
    descuento = cliente.post(
        "/api/v1/descuentos",
        json={
            "id_producto_fk": producto["id_producto"],
            "tipo_descuento": "PORCENTAJE",
            "valor_descuento": "20.00",
        },
        headers=cabeceras_admin,
    ).json()
    cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 1},
        headers=cabeceras_cliente,
    )
    assert cliente.get("/api/v1/carrito", headers=cabeceras_cliente).json()["total"] == "24000.00"

    cliente.post(
        f"/api/v1/descuentos/{descuento['id_descuento']}/desactivar",
        headers=cabeceras_admin,
    )
    assert cliente.get("/api/v1/carrito", headers=cabeceras_cliente).json()["total"] == "30000.00"


# --- actualizar cantidad -----------------------------------------------------

def test_actualizar_cantidad(cliente, cabeceras_cliente, producto):
    creado = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 1},
        headers=cabeceras_cliente,
    ).json()
    id_detalle = creado["items"][0]["id_detalle_carrito"]

    respuesta = cliente.patch(
        f"/api/v1/carrito/items/{id_detalle}",
        json={"cantidad": 4},
        headers=cabeceras_cliente,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["items"][0]["cantidad"] == 4
    assert respuesta.json()["total"] == "120000.00"


def test_actualizar_a_cantidad_cero_da_422(cliente, cabeceras_cliente, producto):
    creado = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 1},
        headers=cabeceras_cliente,
    ).json()
    id_detalle = creado["items"][0]["id_detalle_carrito"]

    respuesta = cliente.patch(
        f"/api/v1/carrito/items/{id_detalle}",
        json={"cantidad": 0},
        headers=cabeceras_cliente,
    )
    assert respuesta.status_code == 422


def test_actualizar_por_encima_del_stock_da_400(
    cliente, cabeceras_cliente, producto
):
    creado = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 1},
        headers=cabeceras_cliente,
    ).json()
    id_detalle = creado["items"][0]["id_detalle_carrito"]

    respuesta = cliente.patch(
        f"/api/v1/carrito/items/{id_detalle}",
        json={"cantidad": 99},
        headers=cabeceras_cliente,
    )
    assert respuesta.status_code == 400


def test_actualizar_linea_inexistente_da_404(cliente, cabeceras_cliente):
    respuesta = cliente.patch(
        "/api/v1/carrito/items/9999", json={"cantidad": 2}, headers=cabeceras_cliente
    )
    assert respuesta.status_code == 404


# --- quitar / vaciar (baja logica, no DELETE) -------------------------------

def test_quitar_no_borra_la_fila(cliente, cabeceras_cliente, producto, sesion):
    creado = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 2},
        headers=cabeceras_cliente,
    ).json()
    id_detalle = creado["items"][0]["id_detalle_carrito"]

    respuesta = cliente.post(
        f"/api/v1/carrito/items/{id_detalle}/quitar", headers=cabeceras_cliente
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["items"] == []
    assert respuesta.json()["total"] == "0.00"

    from app.models.detalle_carrito import DetalleCarrito

    fila = sesion.get(DetalleCarrito, id_detalle)
    assert fila is not None
    assert fila.inhabilitado is True


def test_quitar_dos_veces_da_404(cliente, cabeceras_cliente, producto):
    creado = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 1},
        headers=cabeceras_cliente,
    ).json()
    id_detalle = creado["items"][0]["id_detalle_carrito"]

    cliente.post(f"/api/v1/carrito/items/{id_detalle}/quitar", headers=cabeceras_cliente)
    respuesta = cliente.post(
        f"/api/v1/carrito/items/{id_detalle}/quitar", headers=cabeceras_cliente
    )
    assert respuesta.status_code == 404


def test_reagregar_despues_de_quitar_reutiliza_la_fila(
    cliente, cabeceras_cliente, producto, sesion
):
    creado = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 2},
        headers=cabeceras_cliente,
    ).json()
    id_detalle = creado["items"][0]["id_detalle_carrito"]
    cliente.post(f"/api/v1/carrito/items/{id_detalle}/quitar", headers=cabeceras_cliente)

    cuerpo = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 3},
        headers=cabeceras_cliente,
    ).json()

    assert len(cuerpo["items"]) == 1
    assert cuerpo["items"][0]["id_detalle_carrito"] == id_detalle
    assert cuerpo["items"][0]["cantidad"] == 3

    from app.models.detalle_carrito import DetalleCarrito

    total_filas = sesion.query(DetalleCarrito).count()
    assert total_filas == 1


def test_vaciar_carrito(cliente, cabeceras_cliente, producto, producto_sin_inventario):
    for producto_actual in (producto, producto_sin_inventario):
        cliente.post(
            "/api/v1/carrito/items",
            json={"id_producto": producto_actual["id_producto"], "cantidad": 1},
            headers=cabeceras_cliente,
        )
    respuesta = cliente.post("/api/v1/carrito/vaciar", headers=cabeceras_cliente)
    assert respuesta.status_code == 200
    assert respuesta.json()["items"] == []
    assert respuesta.json()["total_unidades"] == 0


def test_vaciar_carrito_ya_vacio(cliente, cabeceras_cliente):
    respuesta = cliente.post("/api/v1/carrito/vaciar", headers=cabeceras_cliente)
    assert respuesta.status_code == 200
    assert respuesta.json()["items"] == []


# --- aislamiento entre usuarios ---------------------------------------------

def test_cada_usuario_tiene_su_carrito(cliente, cabeceras_cliente, cabeceras_otro, producto):
    cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 2},
        headers=cabeceras_cliente,
    )
    carrito_cliente = cliente.get("/api/v1/carrito", headers=cabeceras_cliente).json()
    carrito_otro = cliente.get("/api/v1/carrito", headers=cabeceras_otro).json()

    assert carrito_cliente["id_carrito"] != carrito_otro["id_carrito"]
    assert len(carrito_cliente["items"]) == 1
    assert carrito_otro["items"] == []


def test_no_puede_tocar_la_linea_de_otro_usuario(
    cliente, cabeceras_cliente, cabeceras_otro, producto
):
    creado = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 1},
        headers=cabeceras_cliente,
    ).json()
    id_detalle = creado["items"][0]["id_detalle_carrito"]

    respuesta = cliente.patch(
        f"/api/v1/carrito/items/{id_detalle}",
        json={"cantidad": 5},
        headers=cabeceras_otro,
    )
    assert respuesta.status_code == 404


def test_no_puede_quitar_la_linea_de_otro_usuario(
    cliente, cabeceras_cliente, cabeceras_otro, producto
):
    creado = cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 1},
        headers=cabeceras_cliente,
    ).json()
    id_detalle = creado["items"][0]["id_detalle_carrito"]

    respuesta = cliente.post(
        f"/api/v1/carrito/items/{id_detalle}/quitar", headers=cabeceras_otro
    )
    assert respuesta.status_code == 404