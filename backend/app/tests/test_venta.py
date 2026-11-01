"""Tests del modulo de ventas y facturas.

Cubre: generacion automatica al entregar el pedido, idempotencia, copia de
precios con descuento, factura, anulacion (baja logica) y visibilidad por rol.
"""

import pytest

from app.core.security import hashear_password
from app.models.detalle_venta import DetalleVenta
from app.models.factura import Factura
from app.models.inventario import Inventario
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from app.models.venta import Venta


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
def cabeceras_vendedor(cliente, sesion):
    crear_usuario(sesion, "vendedor@toronto.com", id_rol=3)
    return token_de(cliente, "vendedor@toronto.com")


@pytest.fixture()
def cabeceras_cliente(cliente, sesion):
    crear_usuario(sesion, "cliente@toronto.com", id_rol=2)
    return token_de(cliente, "cliente@toronto.com")


@pytest.fixture()
def cabeceras_otro(cliente, sesion):
    crear_usuario(sesion, "otro@toronto.com", id_rol=2)
    return token_de(cliente, "otro@toronto.com")


@pytest.fixture()
def producto(cliente, cabeceras_admin, sesion):
    """Camisa de 30.000 con 10 unidades."""
    creado = cliente.post(
        "/api/v1/productos",
        json={"nombre": "Camisa", "precio": "30000.00"},
        headers=cabeceras_admin,
    ).json()
    sesion.add(
        Inventario(id_producto_fk=creado["id_producto"], cantidad_actual=10, stock_minimo=2)
    )
    sesion.commit()
    return creado


def entregar(cliente, cabeceras, id_pedido: int):
    """Lleva el pedido hasta 'Entregado' pasando por 'Enviado'."""
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
    """Venta generada al entregar un pedido de 2 camisas."""
    cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 2},
        headers=cabeceras_cliente,
    )
    pedido = cliente.post("/api/v1/pedidos", headers=cabeceras_cliente).json()
    entregar(cliente, cabeceras_admin, pedido["id_pedido"])

    return cliente.get(
        f"/api/v1/ventas?id_pedido={pedido['id_pedido']}", headers=cabeceras_admin
    ).json()["items"][0]


# --- generacion automatica ----------------------------------------------------

def test_entregar_genera_la_venta(venta):
    assert venta["estado"] == "Completada"
    assert venta["total_unidades"] == 2
    assert venta["total_pagado"] == "60000.00"
    assert len(venta["items"]) == 1
    assert venta["items"][0]["nombre_producto"] == "Camisa"


def test_entregar_genera_la_factura(venta):
    assert venta["factura"] is not None
    assert venta["factura"]["estado"] == "Vigente"
    assert venta["factura"]["total_factura"] == "60000.00"
    assert venta["factura"]["fecha_factura"] is not None


def test_la_venta_apunta_al_pedido(venta, sesion):
    assert venta["id_pedido_fk"] is not None
    assert sesion.query(Venta).count() == 1
    assert sesion.query(DetalleVenta).count() == 1


def test_pedido_pendiente_no_genera_venta(
    cliente, cabeceras_cliente, cabeceras_admin, producto
):
    cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 1},
        headers=cabeceras_cliente,
    )
    cliente.post("/api/v1/pedidos", headers=cabeceras_cliente)
    assert cliente.get("/api/v1/ventas", headers=cabeceras_admin).json()["total"] == 0


def test_pedido_enviado_no_genera_venta(
    cliente, cabeceras_admin, cabeceras_cliente, producto
):
    cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 1},
        headers=cabeceras_cliente,
    )
    pedido = cliente.post("/api/v1/pedidos", headers=cabeceras_cliente).json()
    cliente.patch(
        f"/api/v1/pedidos/{pedido['id_pedido']}/estado",
        json={"estado": "Enviado"},
        headers=cabeceras_admin,
    )
    assert cliente.get("/api/v1/ventas", headers=cabeceras_admin).json()["total"] == 0


def test_venta_copia_el_precio_con_descuento(
    cliente, cabeceras_admin, cabeceras_cliente, producto
):
    """El precio congelado en el pedido (con 10% de descuento) llega a la venta."""
    cliente.post(
        "/api/v1/descuentos",
        json={
            "id_producto_fk": producto["id_producto"],
            "tipo_descuento": "PORCENTAJE",
            "valor_descuento": "10.00",
        },
        headers=cabeceras_admin,
    )
    cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 2},
        headers=cabeceras_cliente,
    )
    pedido = cliente.post("/api/v1/pedidos", headers=cabeceras_cliente).json()
    entregar(cliente, cabeceras_admin, pedido["id_pedido"])

    cuerpo = cliente.get(
        f"/api/v1/ventas/{cliente.get('/api/v1/ventas', headers=cabeceras_admin).json()['items'][0]['id_venta']}",
        headers=cabeceras_admin,
    ).json()

    item = cuerpo["items"][0]
    assert item["precio_lista"] == "30000.00"
    assert item["descuento_unitario"] == "3000.00"
    assert item["precio_unitario"] == "27000.00"
    assert item["descuento_total"] == "6000.00"
    assert cuerpo["total_pagado"] == "54000.00"
    assert cuerpo["factura"]["total_factura"] == "54000.00"


def test_la_venta_no_recalcula_si_el_precio_cambia_despues(
    cliente, cabeceras_admin, cabeceras_cliente, producto, venta
):
    """El producto sube de precio: la venta ya emitida no se mueve."""
    cliente.patch(
        f"/api/v1/productos/{producto['id_producto']}",
        json={"precio": "99000.00"},
        headers=cabeceras_admin,
    )
    cuerpo = cliente.get(
        f"/api/v1/ventas/{venta['id_venta']}", headers=cabeceras_admin
    ).json()
    assert cuerpo["total_pagado"] == "60000.00"


# --- idempotencia -------------------------------------------------------------

def test_entregar_dos_veces_no_duplica_la_venta(
    cliente, cabeceras_admin, cabeceras_cliente, producto, sesion
):
    cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 1},
        headers=cabeceras_cliente,
    )
    pedido = cliente.post("/api/v1/pedidos", headers=cabeceras_cliente).json()
    entregar(cliente, cabeceras_admin, pedido["id_pedido"])

    # Segundo intento de entrega: debe dar 409 y no crear otra venta.
    respuesta = cliente.patch(
        f"/api/v1/pedidos/{pedido['id_pedido']}/estado",
        json={"estado": "Entregado"},
        headers=cabeceras_admin,
    )
    assert respuesta.status_code == 409
    assert sesion.query(Venta).count() == 1
    assert sesion.query(Factura).count() == 1


def test_servicio_crear_desde_pedido_es_idempotente(sesion, cliente, cabeceras_admin,
                                                    cabeceras_cliente, producto):
    """Llamar dos veces al servicio devuelve la misma venta, no crea otra."""
    from app.repositories.pedido import PedidoRepositorio
    from app.services.venta import crear_desde_pedido

    cliente.post(
        "/api/v1/carrito/items",
        json={"id_producto": producto["id_producto"], "cantidad": 1},
        headers=cabeceras_cliente,
    )
    pedido_json = cliente.post("/api/v1/pedidos", headers=cabeceras_cliente).json()

    pedido = PedidoRepositorio(sesion).buscar_por_id(pedido_json["id_pedido"])
    primera = crear_desde_pedido(sesion, pedido)
    segunda = crear_desde_pedido(sesion, pedido)
    sesion.commit()

    assert primera.id_venta == segunda.id_venta
    assert sesion.query(Venta).count() == 1


# --- consultas y visibilidad --------------------------------------------------

def test_listar_ventas_admin(cliente, cabeceras_admin, venta):
    cuerpo = cliente.get("/api/v1/ventas", headers=cabeceras_admin).json()
    assert cuerpo["total"] == 1
    assert cuerpo["items"][0]["id_venta"] == venta["id_venta"]


def test_cliente_ve_solo_sus_ventas(cliente, cabeceras_cliente, cabeceras_otro, venta):
    assert cliente.get("/api/v1/ventas", headers=cabeceras_cliente).json()["total"] == 1
    assert cliente.get("/api/v1/ventas", headers=cabeceras_otro).json()["total"] == 0


def test_vendedor_ve_todas(cliente, cabeceras_vendedor, venta):
    assert cliente.get("/api/v1/ventas", headers=cabeceras_vendedor).json()["total"] == 1


def test_detalle_venta_ajena_da_404(cliente, cabeceras_otro, venta):
    respuesta = cliente.get(f"/api/v1/ventas/{venta['id_venta']}", headers=cabeceras_otro)
    assert respuesta.status_code == 404


def test_detalle_inexistente_da_404(cliente, cabeceras_admin):
    assert cliente.get("/api/v1/ventas/9999", headers=cabeceras_admin).status_code == 404


def test_filtro_por_pedido(cliente, cabeceras_admin, venta):
    cuerpo = cliente.get(
        f"/api/v1/ventas?id_pedido={venta['id_pedido_fk']}", headers=cabeceras_admin
    ).json()
    assert cuerpo["total"] == 1
    assert cliente.get(
        "/api/v1/ventas?id_pedido=9999", headers=cabeceras_admin
    ).json()["total"] == 0


def test_factura_endpoint(cliente, cabeceras_admin, venta):
    respuesta = cliente.get(
        f"/api/v1/ventas/{venta['id_venta']}/factura", headers=cabeceras_admin
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["id_factura"] == venta["factura"]["id_factura"]


def test_listar_sin_token_da_401(cliente):
    assert cliente.get("/api/v1/ventas").status_code == 401


# --- anulacion (baja logica) --------------------------------------------------

def test_anular_venta_y_factura(cliente, cabeceras_admin, venta, sesion):
    respuesta = cliente.post(
        f"/api/v1/ventas/{venta['id_venta']}/anular", headers=cabeceras_admin
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "Anulada"
    assert respuesta.json()["factura"]["estado"] == "Anulada"

    # Nada se borro: la venta y sus lineas siguen ahi.
    assert sesion.query(Venta).count() == 1
    assert sesion.query(DetalleVenta).count() == 1


def test_anular_dos_veces_da_409(cliente, cabeceras_admin, venta):
    cliente.post(f"/api/v1/ventas/{venta['id_venta']}/anular", headers=cabeceras_admin)
    respuesta = cliente.post(
        f"/api/v1/ventas/{venta['id_venta']}/anular", headers=cabeceras_admin
    )
    assert respuesta.status_code == 409


def test_cliente_no_puede_anular(cliente, cabeceras_cliente, venta):
    respuesta = cliente.post(
        f"/api/v1/ventas/{venta['id_venta']}/anular", headers=cabeceras_cliente
    )
    assert respuesta.status_code == 403


def test_vendedor_puede_anular(cliente, cabeceras_vendedor, venta):
    respuesta = cliente.post(
        f"/api/v1/ventas/{venta['id_venta']}/anular", headers=cabeceras_vendedor
    )
    assert respuesta.status_code == 200


def test_anular_no_devuelve_inventario(cliente, cabeceras_admin, venta, sesion, producto):
    """Devolver stock es tarea del modulo de devoluciones, no de anular."""
    fila = sesion.query(Inventario).filter(
        Inventario.id_producto_fk == producto["id_producto"]
    ).first()
    antes = fila.cantidad_actual

    cliente.post(f"/api/v1/ventas/{venta['id_venta']}/anular", headers=cabeceras_admin)

    sesion.expire_all()
    fila = sesion.query(Inventario).filter(
        Inventario.id_producto_fk == producto["id_producto"]
    ).first()
    assert fila.cantidad_actual == antes


def test_venta_anulada_sigue_apareciendo_con_filtro(cliente, cabeceras_admin, venta):
    cliente.post(f"/api/v1/ventas/{venta['id_venta']}/anular", headers=cabeceras_admin)
    assert cliente.get(
        "/api/v1/ventas?estado=Anulada", headers=cabeceras_admin
    ).json()["total"] == 1
    assert cliente.get(
        "/api/v1/ventas?estado=Completada", headers=cabeceras_admin
    ).json()["total"] == 0
