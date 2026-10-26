import pytest

from app.core.security import hashear_password
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol


def crear_usuario_con_rol(sesion, correo: str, id_rol: int) -> Usuario:
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
    r = cliente.post(
        "/api/v1/auth/login", json={"correo": correo, "password": "secreta123"}
    )
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


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
    return cliente.post(
        "/api/v1/productos",
        json={"nombre": "Camisa", "precio": "30000.00", "talla": "M", "color": "Rojo"},
        headers=cabeceras_admin,
    ).json()


@pytest.fixture()
def inventario(cliente, cabeceras_admin, producto):
    r = cliente.post(
        "/api/v1/inventario",
        json={
            "id_producto_fk": producto["id_producto"],
            "cantidad_actual": 10,
            "stock_minimo": 5,
        },
        headers=cabeceras_admin,
    )
    assert r.status_code == 201, r.text
    return r.json()


# --- creacion ----------------------------------------------------------------

def test_crear_inventario(cliente, inventario):
    assert inventario["cantidad_actual"] == 10
    assert inventario["stock_minimo"] == 5
    assert inventario["inhabilitado"] is False


def test_crear_para_producto_inexistente_da_404(cliente, cabeceras_admin):
    r = cliente.post(
        "/api/v1/inventario",
        json={"id_producto_fk": 999999, "cantidad_actual": 1},
        headers=cabeceras_admin,
    )
    assert r.status_code == 404


def test_no_permite_dos_filas_para_el_mismo_producto(
    cliente, cabeceras_admin, producto, inventario
):
    r = cliente.post(
        "/api/v1/inventario",
        json={"id_producto_fk": producto["id_producto"], "cantidad_actual": 3},
        headers=cabeceras_admin,
    )
    assert r.status_code == 409


def test_crear_como_cliente_da_403(cliente, cabeceras_cliente, producto):
    r = cliente.post(
        "/api/v1/inventario",
        json={"id_producto_fk": producto["id_producto"], "cantidad_actual": 1},
        headers=cabeceras_cliente,
    )
    assert r.status_code == 403


# --- entradas ----------------------------------------------------------------

def test_entrada_suma_stock(cliente, cabeceras_admin, inventario):
    r = cliente.post(
        f"/api/v1/inventario/{inventario['id_inventario']}/entrada",
        json={"cantidad": 15, "motivo": "Compra a proveedor"},
        headers=cabeceras_admin,
    )
    assert r.status_code == 201
    assert r.json()["tipo_movimiento"] == "ENTRADA"
    assert r.json()["cantidad"] == 15

    detalle = cliente.get(f"/api/v1/inventario/{inventario['id_inventario']}").json()
    assert detalle["cantidad_actual"] == 25


def test_entrada_registra_quien_la_hizo(cliente, cabeceras_admin, inventario):
    r = cliente.post(
        f"/api/v1/inventario/{inventario['id_inventario']}/entrada",
        json={"cantidad": 1},
        headers=cabeceras_admin,
    )
    assert r.json()["usuario_responsable"] == "admin"
    assert r.json()["nombre_producto"] == "Camisa"
    assert r.json()["fecha_hora"] is not None


def test_entrada_cantidad_cero_da_422(cliente, cabeceras_admin, inventario):
    r = cliente.post(
        f"/api/v1/inventario/{inventario['id_inventario']}/entrada",
        json={"cantidad": 0},
        headers=cabeceras_admin,
    )
    assert r.status_code == 422


# --- salidas -----------------------------------------------------------------

def test_salida_resta_stock(cliente, cabeceras_admin, inventario):
    r = cliente.post(
        f"/api/v1/inventario/{inventario['id_inventario']}/salida",
        json={"cantidad": 4, "motivo": "Venta"},
        headers=cabeceras_admin,
    )
    assert r.status_code == 201
    detalle = cliente.get(f"/api/v1/inventario/{inventario['id_inventario']}").json()
    assert detalle["cantidad_actual"] == 6


def test_salida_mayor_al_stock_da_400(cliente, cabeceras_admin, inventario):
    r = cliente.post(
        f"/api/v1/inventario/{inventario['id_inventario']}/salida",
        json={"cantidad": 999},
        headers=cabeceras_admin,
    )
    assert r.status_code == 400
    assert r.json()["error"] == "ReglaNegocio"
    assert "insuficiente" in r.json()["detalle"]


def test_salida_no_deja_stock_negativo(cliente, cabeceras_admin, inventario):
    cliente.post(
        f"/api/v1/inventario/{inventario['id_inventario']}/salida",
        json={"cantidad": 999},
        headers=cabeceras_admin,
    )
    detalle = cliente.get(f"/api/v1/inventario/{inventario['id_inventario']}").json()
    assert detalle["cantidad_actual"] == 10  # intacto


# --- alertas -----------------------------------------------------------------

def test_salida_que_baja_del_minimo_genera_alerta(
    cliente, cabeceras_admin, inventario
):
    assert cliente.get("/api/v1/inventario/alertas").json()["total"] == 0

    cliente.post(
        f"/api/v1/inventario/{inventario['id_inventario']}/salida",
        json={"cantidad": 6, "motivo": "Deja 4, minimo 5"},
        headers=cabeceras_admin,
    )
    alertas = cliente.get("/api/v1/inventario/alertas").json()
    assert alertas["total"] == 1
    assert alertas["items"][0]["nivel_stock"] == 4


def test_no_duplica_alerta_el_mismo_dia(cliente, cabeceras_admin, inventario):
    url = f"/api/v1/inventario/{inventario['id_inventario']}/salida"
    cliente.post(url, json={"cantidad": 5}, headers=cabeceras_admin)
    cliente.post(url, json={"cantidad": 1}, headers=cabeceras_admin)
    assert cliente.get("/api/v1/inventario/alertas").json()["total"] == 1


def test_salida_por_encima_del_minimo_no_alerta(
    cliente, cabeceras_admin, inventario
):
    cliente.post(
        f"/api/v1/inventario/{inventario['id_inventario']}/salida",
        json={"cantidad": 1},
        headers=cabeceras_admin,
    )
    assert cliente.get("/api/v1/inventario/alertas").json()["total"] == 0


# --- ajuste ------------------------------------------------------------------

def test_ajuste_fija_valor_absoluto(cliente, cabeceras_admin, inventario):
    r = cliente.post(
        f"/api/v1/inventario/{inventario['id_inventario']}/ajuste",
        json={"cantidad_actual": 3, "motivo": "Conteo fisico"},
        headers=cabeceras_admin,
    )
    assert r.status_code == 201
    assert r.json()["tipo_movimiento"] == "AJUSTE"
    assert r.json()["cantidad"] == -7  # diferencia: 3 - 10
    detalle = cliente.get(f"/api/v1/inventario/{inventario['id_inventario']}").json()
    assert detalle["cantidad_actual"] == 3


def test_ajuste_sin_diferencia_da_400(cliente, cabeceras_admin, inventario):
    r = cliente.post(
        f"/api/v1/inventario/{inventario['id_inventario']}/ajuste",
        json={"cantidad_actual": 10},
        headers=cabeceras_admin,
    )
    assert r.status_code == 400


# --- historial ---------------------------------------------------------------

def test_movimientos_guarda_el_historial(cliente, cabeceras_admin, inventario):
    base = f"/api/v1/inventario/{inventario['id_inventario']}"
    cliente.post(f"{base}/entrada", json={"cantidad": 5}, headers=cabeceras_admin)
    cliente.post(f"{base}/salida", json={"cantidad": 2}, headers=cabeceras_admin)
    cliente.post(f"{base}/ajuste", json={"cantidad_actual": 20}, headers=cabeceras_admin)

    historial = cliente.get("/api/v1/inventario/movimientos").json()
    assert historial["total"] == 3
    # el mas reciente primero
    assert [m["tipo_movimiento"] for m in historial["items"]] == [
        "AJUSTE", "SALIDA", "ENTRADA"
    ]


def test_movimientos_filtra_por_tipo(cliente, cabeceras_admin, inventario):
    base = f"/api/v1/inventario/{inventario['id_inventario']}"
    cliente.post(f"{base}/entrada", json={"cantidad": 5}, headers=cabeceras_admin)
    cliente.post(f"{base}/salida", json={"cantidad": 1}, headers=cabeceras_admin)

    salidas = cliente.get("/api/v1/inventario/movimientos?tipo_movimiento=SALIDA").json()
    assert salidas["total"] == 1
    assert salidas["items"][0]["tipo_movimiento"] == "SALIDA"


def test_movimientos_tipo_invalido_da_422(cliente):
    assert (
        cliente.get("/api/v1/inventario/movimientos?tipo_movimiento=PERDIDA").status_code
        == 422
    )


# --- vista agregada ----------------------------------------------------------

def test_stock_por_producto(cliente, cabeceras_admin, producto, inventario):
    r = cliente.get("/api/v1/inventario/stock")
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["total"] == 1
    fila = cuerpo["items"][0]
    assert fila["nombre"] == "Camisa"
    assert fila["stock_total"] == 10
    assert fila["bajo_minimo"] is False
    assert fila["filas_inventario"] == 1


def test_stock_por_producto_marca_bajo_minimo(
    cliente, cabeceras_admin, inventario
):
    cliente.post(
        f"/api/v1/inventario/{inventario['id_inventario']}/salida",
        json={"cantidad": 8},
        headers=cabeceras_admin,
    )
    fila = cliente.get("/api/v1/inventario/stock").json()["items"][0]
    assert fila["stock_total"] == 2
    assert fila["bajo_minimo"] is True


# --- errores -----------------------------------------------------------------

def test_entrada_a_fila_inexistente_da_404(cliente, cabeceras_admin):
    r = cliente.post(
        "/api/v1/inventario/999999/entrada", json={"cantidad": 1}, headers=cabeceras_admin
    )
    assert r.status_code == 404


def test_entrada_sin_token_da_401(cliente, inventario):
    r = cliente.post(
        f"/api/v1/inventario/{inventario['id_inventario']}/entrada",
        json={"cantidad": 1},
    )
    assert r.status_code == 401