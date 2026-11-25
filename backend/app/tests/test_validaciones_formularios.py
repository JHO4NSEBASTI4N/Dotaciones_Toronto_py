"""Reglas de entrada para los formularios: mismas reglas sin importar el cliente."""

import pytest
from pydantic import ValidationError

from app.schemas.contacto import MensajeContacto
from app.schemas.devolucion import DevolucionCrear
from app.schemas.descuento import DescuentoActualizar, DescuentoCrear
from app.schemas.inventario import AjusteStock, EntradaStock, InventarioCrear, SalidaStock
from app.schemas.pedido import PedidoEstadoActualizar
from app.schemas.producto import ProductoCrear
from app.schemas.recuperacion import NuevaPassword
from app.schemas.rol import RolCrear
from app.schemas.usuario import UsuarioActualizar, UsuarioRegistro
from app.api.v1.endpoints.venta import _validar_periodo
from app.core.exceptions import ReglaNegocio
from datetime import date


def test_usuario_normaliza_y_acepta_nombres_con_guion_o_apostrofe():
    usuario = UsuarioRegistro(
        nombre="  Ana-María O’Neil  ",
        correo=" persona@ejemplo.com ",
        documento="12345678",
        telefono="3001234567",
        direccion="  Calle 1, Bogotá  ",
        password="ClaveFuerte123!",
    )
    assert usuario.nombre == "Ana-María O’Neil"
    assert usuario.correo == "persona@ejemplo.com"
    assert usuario.direccion == "Calle 1, Bogotá"


@pytest.mark.parametrize(
    "telefono",
    ["+1 (415) 555-2671", "+44 (0)20 7946 0958", "300 123 4567", "(601) 555-0101"],
)
def test_telefono_acepta_formatos_nacionales_e_internacionales(telefono):
    datos = {
        "nombre": "Ana Pérez",
        "correo": "ana@ejemplo.com",
        "telefono": telefono,
        "password": "ClaveFuerte123!",
    }
    assert UsuarioRegistro(**datos).telefono == telefono
    assert UsuarioActualizar(telefono=telefono).telefono == telefono


@pytest.mark.parametrize(
    "cambios",
    [
        {"documento": "12A456"},
        {"documento": "12345"},
        {"telefono": "123456"},
        {"telefono": "1234567890123456"},
        {"telefono": "++1 (415) 555-2671"},
        {"telefono": "+1 (415 555-2671"},
        {"nombre": "   "},
        {"password": "Clave1234"},
    ],
)
def test_registro_rechaza_datos_fuera_de_formato(cambios):
    datos = {
        "nombre": "Ana Pérez",
        "correo": "ana@ejemplo.com",
        "documento": None,
        "telefono": None,
        "direccion": None,
        "password": "ClaveFuerte123!",
    }
    datos.update(cambios)
    with pytest.raises(ValidationError):
        UsuarioRegistro(**datos)


def test_actualizacion_contacto_permite_limpiar_opcionales():
    datos = UsuarioActualizar(telefono="  ", direccion="  ")
    assert datos.telefono is None
    assert datos.direccion is None


def test_producto_rechaza_nombre_vacio_y_precio_no_positivo():
    with pytest.raises(ValidationError):
        ProductoCrear(nombre="   ", precio=10, categoria="Camisas")
    with pytest.raises(ValidationError):
        ProductoCrear(nombre="Camisa", precio=0, categoria="Camisas")


def test_producto_recorta_textos_y_vacia_opcionales():
    producto = ProductoCrear(
        nombre="  Camisa escolar  ", precio="25000.00", categoria="  Uniformes  ", talla="  "
    )
    assert producto.nombre == "Camisa escolar"
    assert producto.categoria == "Uniformes"
    assert producto.talla is None


def test_rol_no_acepta_nombre_en_blanco():
    with pytest.raises(ValidationError):
        RolCrear(nombre_rol="   ")
    rol = RolCrear(nombre_rol="  Supervisor  ", descripcion_rol="  ")
    assert rol.nombre_rol == "Supervisor"
    assert rol.descripcion_rol is None


def test_inventario_exige_producto_y_cantidades_no_negativas():
    with pytest.raises(ValidationError):
        InventarioCrear(id_producto_fk=0)
    with pytest.raises(ValidationError):
        InventarioCrear(id_producto_fk=1, cantidad_actual=-1)
    movimiento = EntradaStock(cantidad=3, motivo="  compra  ")
    assert movimiento.motivo == "compra"
    with pytest.raises(ValidationError):
        EntradaStock(cantidad=0)


def test_devolucion_exige_motivo_util_y_no_solo_espacios():
    with pytest.raises(ValidationError):
        DevolucionCrear(id_detalle_venta=1, cantidad=1, motivo="     ")
    solicitud = DevolucionCrear(id_detalle_venta=1, cantidad=1, motivo="  Talla incorrecta  ")
    assert solicitud.motivo == "Talla incorrecta"


def test_filtro_de_ventas_rechaza_periodo_invertido():
    with pytest.raises(ReglaNegocio):
        _validar_periodo(date(2026, 11, 2), date(2026, 10, 1))
    _validar_periodo(date(2026, 10, 1), date(2026, 11, 2))


def test_contacto_y_recuperacion_validan_correo_y_password():
    with pytest.raises(ValidationError):
        MensajeContacto(nombre="A", correo="mal-correo", mensaje="Hola")
    with pytest.raises(ValidationError):
        NuevaPassword(correo="ana@ejemplo.com", ticket="x" * 45, password_nueva="debil123")


def test_descuento_valida_tipo_rangos_y_periodo():
    with pytest.raises(ValidationError):
        DescuentoCrear(
            id_producto_fk=1,
            tipo_descuento="PROMO",
            valor_descuento=10,
            fecha_inicio=date(2026, 11, 2),
            fecha_fin=date(2026, 11, 1),
        )
    with pytest.raises(ValidationError):
        DescuentoCrear(
            id_producto_fk=1,
            tipo_descuento="PORCENTAJE",
            valor_descuento=25,
            fecha_inicio=date(2026, 11, 2),
            fecha_fin=date(2026, 11, 1),
        )
    with pytest.raises(ValidationError):
        DescuentoCrear(
            id_producto_fk=1,
            tipo_descuento="PORCENTAJE",
            valor_descuento=100.01,
        )
    descuento = DescuentoCrear(
        id_producto_fk=1,
        tipo_descuento="PORCENTAJE",
        valor_descuento=25,
        fecha_inicio=date(2026, 11, 1),
        fecha_fin=date(2026, 11, 2),
    )
    assert descuento.valor_descuento == 25
    with pytest.raises(ValidationError):
        DescuentoActualizar(tipo_descuento=None)


def test_pedido_y_movimientos_usan_estados_catalogados_y_cantidades_enteras():
    assert PedidoEstadoActualizar(estado="Entregado", metodo_pago="  Tarjeta   crédito ").metodo_pago == "Tarjeta crédito"
    with pytest.raises(ValidationError):
        PedidoEstadoActualizar(estado="En proceso")
    assert AjusteStock(cantidad_actual=0).cantidad_actual == 0
    with pytest.raises(ValidationError):
        AjusteStock(cantidad_actual=-1)
    with pytest.raises(ValidationError):
        SalidaStock(cantidad=0)
