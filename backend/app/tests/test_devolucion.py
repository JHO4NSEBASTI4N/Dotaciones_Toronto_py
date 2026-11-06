"""Tests del modulo de devoluciones.

Cubre: creacion en Pendiente, validacion de cantidad contra lo vendido,
motivo obligatorio, estados finales, que aprobar NO mueva el stock,
visibilidad por rol y que no exista un DELETE.
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
        # Se deja el rol de defecto igual al rol asignado: la columna vieja
        # usuario.id_rol_fk y la tabla usuario_rol deben decir lo mismo.
        id_rol_fk=id_rol,
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
def cabeceras_vendedor(cliente, sesion):
    crear_usuario(sesion, "vendedor@toronto.com", id_rol=3)
    return token_de(cliente, "vendedor@toronto.com")


@pytest.fixture()
def cabeceras_bodega(cliente, sesion):
    crear_usuario(sesion, "bodega@toronto.com", id_rol=4)
    return token_de(cliente, "bodega@toronto.com")


@pytest.fixture()
def cabeceras_cliente(cliente, sesion):
    usuario = crear_usuario(sesion, "cliente@toronto.com", id_rol=2)
    return token_de(cliente, "cliente@toronto.com")


@pytest.fixture()
def cabeceras_otro(cliente, sesion):
    crear_usuario(sesion, "otro@toronto.com", id_rol=2)
    return token_de(cliente, "otro@toronto.com")


@pytest.fixture()
def producto(cliente, cabeceras_admin, sesion):
    """Camisa de 30.000 con 10 unidades en inventario."""
    creado = cliente.post(
        "/api/v1/productos",
        json={"nombre": "Camisa", "precio": "30000.00"},
        headers=cabeceras_admin,
    ).json()
    sesion.add(
        Inventario(
            id_producto_fk=creado["id_producto"],
            cantidad_actual=10,
            stock_minimo=2,
        )
    )
    sesion.commit()
    return creado


def entregar(cliente, cabeceras, id_pedido: int):
    for estado in ("Enviado", "Entregado"):
        respuesta = cliente.patch(
            f"/api/v1/pedidos/{id_pedido}/estado",
            json={"estado": estado},
            headers=cabeceras,
        )
        assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


@pytest.fixture()
def venta(cliente, cabeceras_admin, cabeceras_cliente, producto):
    """Venta de 5 camisas (para poder devolver en varias tandas)."""
    cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 5},
        headers=cabeceras_cliente,
    )
    pedido = cliente.post("/api/v1/pedidos", headers=cabeceras_cliente).json()
    entregar(cliente, cabeceras_admin, pedido["id_pedido"])
    return cliente.get(
        f"/api/v1/ventas?id_pedido={pedido['id_pedido']}", headers=cabeceras_admin
    ).json()["items"][0]


@pytest.fixture()
def linea(venta):
    """La linea de venta sobre la que se devuelve."""
    return venta["items"][0]


def crear_devolucion(cliente, cabeceras, id_detalle_venta, cantidad=1, motivo="Talla equivocada"):
    return cliente.post(
        "/api/v1/devoluciones",
        json={
            "id_detalle_venta": id_detalle_venta,
            "cantidad": cantidad,
            "motivo": motivo,
        },
        headers=cabeceras,
    )


# --- creacion -----------------------------------------------------------------

def test_crear_devolucion_queda_pendiente(cliente, cabeceras_cliente, linea):
    respuesta = crear_devolucion(cliente, cabeceras_cliente, linea["id_detalle_venta"])
    assert respuesta.status_code == 201, respuesta.text
    datos = respuesta.json()
    assert datos["estado"] == "Pendiente"
    assert datos["cantidad"] == 1
    assert datos["nombre_producto"] == "Camisa"
    assert datos["cantidad_vendida"] == 5
    assert datos["cantidad_devuelta"] == 0


def test_devolucion_calcula_el_valor_devuelto(cliente, cabeceras_cliente, linea):
    respuesta = crear_devolucion(
        cliente, cabeceras_cliente, linea["id_detalle_venta"], cantidad=2
    )
    datos = respuesta.json()
    assert datos["valor_unitario"] == "30000.00"
    assert datos["valor_devuelto"] == "60000.00"


def test_motivo_obligatorio(cliente, cabeceras_cliente, linea):
    respuesta = cliente.post(
        "/api/v1/devoluciones",
        json={
            "id_detalle_venta": linea["id_detalle_venta"],
            "cantidad": 1,
            "motivo": "abc",
        },
        headers=cabeceras_cliente,
    )
    assert respuesta.status_code == 422


def test_cantidad_debe_ser_positiva(cliente, cabeceras_cliente, linea):
    respuesta = crear_devolucion(
        cliente, cabeceras_cliente, linea["id_detalle_venta"], cantidad=0
    )
    assert respuesta.status_code == 422


def test_linea_inexistente_da_404(cliente, cabeceras_cliente):
    respuesta = crear_devolucion(cliente, cabeceras_cliente, 999999)
    assert respuesta.status_code == 404


def test_sin_token_da_401(cliente, linea):
    respuesta = cliente.post(
        "/api/v1/devoluciones",
        json={
            "id_detalle_venta": linea["id_detalle_venta"],
            "cantidad": 1,
            "motivo": "Talla equivocada",
        },
    )
    assert respuesta.status_code == 401


def test_cliente_no_puede_devolver_venta_ajena(
    cliente, cabeceras_otro, linea
):
    respuesta = crear_devolucion(cliente, cabeceras_otro, linea["id_detalle_venta"])
    assert respuesta.status_code == 404


# --- limite de cantidad -------------------------------------------------------

def test_no_puede_devolver_mas_de_lo_vendido(cliente, cabeceras_cliente, linea):
    respuesta = crear_devolucion(
        cliente, cabeceras_cliente, linea["id_detalle_venta"], cantidad=6
    )
    assert respuesta.status_code == 400
    assert "No se puede devolver 6" in respuesta.json()["detalle"]


def test_puede_devolver_justo_lo_vendido(cliente, cabeceras_cliente, linea):
    respuesta = crear_devolucion(
        cliente, cabeceras_cliente, linea["id_detalle_venta"], cantidad=5
    )
    assert respuesta.status_code == 201


def test_no_se_puede_pasar_del_total_en_varias_tandas(
    cliente, cabeceras_cliente, linea
):
    crear_devolucion(cliente, cabeceras_cliente, linea["id_detalle_venta"], cantidad=3)
    respuesta = crear_devolucion(
        cliente, cabeceras_cliente, linea["id_detalle_venta"], cantidad=3
    )
    assert respuesta.status_code == 400
    assert "disponible: 2" in respuesta.json()["detalle"]


def test_una_pendiente_ocupa_cupo(cliente, cabeceras_cliente, linea):
    crear_devolucion(cliente, cabeceras_cliente, linea["id_detalle_venta"], cantidad=5)
    # Ya se pidieron las 5: cualquier otra solicitud debe fallar.
    respuesta = crear_devolucion(
        cliente, cabeceras_cliente, linea["id_detalle_venta"], cantidad=1
    )
    assert respuesta.status_code == 400


def test_una_rechazada_libera_el_cupo(cliente, cabeceras_cliente, cabeceras_admin, linea):
    primera = crear_devolucion(
        cliente, cabeceras_cliente, linea["id_detalle_venta"], cantidad=5
    ).json()
    cliente.post(
        f"/api/v1/devoluciones/{primera['id_devolucion']}/rechazar",
        headers=cabeceras_admin,
    )
    # Al rechazarse, el cliente puede volver a pedir.
    respuesta = crear_devolucion(
        cliente, cabeceras_cliente, linea["id_detalle_venta"], cantidad=5
    )
    assert respuesta.status_code == 201


# --- aprobar / rechazar -------------------------------------------------------

def test_admin_aprueba(cliente, cabeceras_cliente, cabeceras_admin, linea):
    creada = crear_devolucion(
        cliente, cabeceras_cliente, linea["id_detalle_venta"]
    ).json()
    respuesta = cliente.post(
        f"/api/v1/devoluciones/{creada['id_devolucion']}/aprobar",
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["estado"] == "Aprobada"


def test_vendedor_puede_aprobar(cliente, cabeceras_cliente, cabeceras_vendedor, linea):
    creada = crear_devolucion(
        cliente, cabeceras_cliente, linea["id_detalle_venta"]
    ).json()
    respuesta = cliente.post(
        f"/api/v1/devoluciones/{creada['id_devolucion']}/aprobar",
        headers=cabeceras_vendedor,
    )
    assert respuesta.status_code == 200


def test_bodega_puede_aprobar(cliente, cabeceras_cliente, cabeceras_bodega, linea):
    creada = crear_devolucion(
        cliente, cabeceras_cliente, linea["id_detalle_venta"]
    ).json()
    respuesta = cliente.post(
        f"/api/v1/devoluciones/{creada['id_devolucion']}/aprobar",
        headers=cabeceras_bodega,
    )
    assert respuesta.status_code == 200


def test_cliente_no_puede_aprobar(cliente, cabeceras_cliente, linea):
    creada = crear_devolucion(
        cliente, cabeceras_cliente, linea["id_detalle_venta"]
    ).json()
    respuesta = cliente.post(
        f"/api/v1/devoluciones/{creada['id_devolucion']}/aprobar",
        headers=cabeceras_cliente,
    )
    assert respuesta.status_code == 403


def test_cambiar_estado_por_patch(cliente, cabeceras_cliente, cabeceras_admin, linea):
    creada = crear_devolucion(
        cliente, cabeceras_cliente, linea["id_detalle_venta"]
    ).json()
    respuesta = cliente.patch(
        f"/api/v1/devoluciones/{creada['id_devolucion']}/estado",
        json={"estado": "Rechazada"},
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "Rechazada"


def test_estado_invalido_da_422(cliente, cabeceras_cliente, cabeceras_admin, linea):
    creada = crear_devolucion(
        cliente, cabeceras_cliente, linea["id_detalle_venta"]
    ).json()
    respuesta = cliente.patch(
        f"/api/v1/devoluciones/{creada['id_devolucion']}/estado",
        json={"estado": "Pendiente"},
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 422


def test_no_se_puede_resolver_dos_veces(
    cliente, cabeceras_cliente, cabeceras_admin, linea
):
    creada = crear_devolucion(
        cliente, cabeceras_cliente, linea["id_detalle_venta"]
    ).json()
    cliente.post(
        f"/api/v1/devoluciones/{creada['id_devolucion']}/aprobar",
        headers=cabeceras_admin,
    )
    respuesta = cliente.post(
        f"/api/v1/devoluciones/{creada['id_devolucion']}/rechazar",
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 409


def test_aprobar_dos_veces_da_409(cliente, cabeceras_cliente, cabeceras_admin, linea):
    creada = crear_devolucion(
        cliente, cabeceras_cliente, linea["id_detalle_venta"]
    ).json()
    cliente.post(
        f"/api/v1/devoluciones/{creada['id_devolucion']}/aprobar",
        headers=cabeceras_admin,
    )
    respuesta = cliente.post(
        f"/api/v1/devoluciones/{creada['id_devolucion']}/aprobar",
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 409


# --- regla clave: aprobar NO mueve el stock -----------------------------------

def test_aprobar_no_devuelve_el_stock(
    cliente, cabeceras_cliente, cabeceras_admin, linea, producto
):
    """La decision del equipo: el producto fisico aun no ha vuelto a bodega."""
    antes = cliente.get(
        f"/api/v1/inventario/stock?id_producto={producto['id_producto']}",
        headers=cabeceras_admin,
    ).json()

    creada = crear_devolucion(
        cliente, cabeceras_cliente, linea["id_detalle_venta"], cantidad=2
    ).json()
    cliente.post(
        f"/api/v1/devoluciones/{creada['id_devolucion']}/aprobar",
        headers=cabeceras_admin,
    )

    despues = cliente.get(
        f"/api/v1/inventario/stock?id_producto={producto['id_producto']}",
        headers=cabeceras_admin,
    ).json()

    assert antes == despues, "Aprobar una devolucion NO debe tocar el inventario"


# --- consultas ----------------------------------------------------------------

def test_cliente_ve_solo_sus_devoluciones(
    cliente, cabeceras_cliente, cabeceras_admin, cabeceras_otro, linea
):
    crear_devolucion(cliente, cabeceras_cliente, linea["id_detalle_venta"])

    propias = cliente.get("/api/v1/devoluciones", headers=cabeceras_cliente).json()
    ajenas = cliente.get("/api/v1/devoluciones", headers=cabeceras_otro).json()
    todas = cliente.get("/api/v1/devoluciones", headers=cabeceras_admin).json()

    assert propias["total"] == 1
    assert ajenas["total"] == 0
    assert todas["total"] == 1


def test_filtrar_por_estado(cliente, cabeceras_cliente, cabeceras_admin, linea):
    pendiente = crear_devolucion(
        cliente, cabeceras_cliente, linea["id_detalle_venta"]
    ).json()
    cliente.post(
        f"/api/v1/devoluciones/{pendiente['id_devolucion']}/aprobar",
        headers=cabeceras_admin,
    )
    aprobadas = cliente.get(
        "/api/v1/devoluciones?estado=Aprobada", headers=cabeceras_admin
    ).json()
    pendientes = cliente.get(
        "/api/v1/devoluciones?estado=Pendiente", headers=cabeceras_admin
    ).json()
    assert aprobadas["total"] == 1
    assert pendientes["total"] == 0


def test_estado_invalido_en_filtro_da_400(cliente, cabeceras_admin):
    respuesta = cliente.get(
        "/api/v1/devoluciones?estado=Inventado", headers=cabeceras_admin
    )
    assert respuesta.status_code == 400


def test_cliente_no_ve_devolucion_ajena(cliente, cabeceras_cliente, cabeceras_otro, linea):
    creada = crear_devolucion(
        cliente, cabeceras_cliente, linea["id_detalle_venta"]
    ).json()
    respuesta = cliente.get(
        f"/api/v1/devoluciones/{creada['id_devolucion']}", headers=cabeceras_otro
    )
    assert respuesta.status_code == 404


def test_detalle_inexistente_da_404(cliente, cabeceras_admin):
    respuesta = cliente.get("/api/v1/devoluciones/999999", headers=cabeceras_admin)
    assert respuesta.status_code == 404


# --- reglas del proyecto ------------------------------------------------------

def test_no_existe_delete_en_devoluciones():
    """REGLA DEL PROYECTO: nada se elimina, solo se cambia de estado."""
    from app.main import app as aplicacion

    rutas = aplicacion.openapi()["paths"]
    de_devoluciones = [p for p in rutas if "/devoluciones" in p]
    assert de_devoluciones, "El router de devoluciones debe estar registrado"
    for ruta in de_devoluciones:
        assert "delete" not in rutas[ruta], f"{ruta} no debe tener DELETE"


def test_venta_anulada_no_admite_devoluciones(
    cliente, cabeceras_cliente, cabeceras_admin, venta, linea
):
    cliente.post(f"/api/v1/ventas/{venta['id_venta']}/anular", headers=cabeceras_admin)
    respuesta = crear_devolucion(cliente, cabeceras_cliente, linea["id_detalle_venta"])
    assert respuesta.status_code == 409
    assert "anulada" in respuesta.json()["detalle"]
