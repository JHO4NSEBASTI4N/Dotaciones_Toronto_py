import pytest
from app.core.security import hashear_password
from app.models.inventario import Inventario
from app.models.movimiento_inventario import MovimientoInventario
from app.models.pedido import Pedido
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol

def crear_usuario(sesion, correo: str, id_rol: int=2) -> Usuario:
    usuario = Usuario(nombre=correo.split('@')[0], correo=correo, password=hashear_password('secreta123'), estado='Habilitado')
    sesion.add(usuario)
    sesion.flush()
    sesion.add(UsuarioRol(id_usuario_fk=usuario.id_usuario, id_rol_fk=id_rol))
    sesion.commit()
    sesion.refresh(usuario)
    return usuario

def token_de(cliente, correo: str) -> dict:
    respuesta = cliente.post('/api/v1/auth/login', json={'correo': correo, 'password': 'secreta123'})
    assert respuesta.status_code == 200, respuesta.text
    return {'Authorization': f"Bearer {respuesta.json()['access_token']}"}

@pytest.fixture()
def cabeceras_admin(cliente, sesion):
    crear_usuario(sesion, 'admin@toronto.com', id_rol=1)
    return token_de(cliente, 'admin@toronto.com')

@pytest.fixture()
def cabeceras_vendedor(cliente, sesion):
    crear_usuario(sesion, 'vendedor@toronto.com', id_rol=3)
    return token_de(cliente, 'vendedor@toronto.com')

@pytest.fixture()
def cabeceras_cliente(cliente, sesion):
    crear_usuario(sesion, 'cliente@toronto.com', id_rol=2)
    return token_de(cliente, 'cliente@toronto.com')

@pytest.fixture()
def cabeceras_otro(cliente, sesion):
    crear_usuario(sesion, 'otro@toronto.com', id_rol=2)
    return token_de(cliente, 'otro@toronto.com')

@pytest.fixture()
def producto(cliente, cabeceras_admin, sesion):
    creado = cliente.post('/api/v1/productos', json={'nombre': 'Camisa', 'precio': '30000.00'}, headers=cabeceras_admin).json()
    sesion.add(Inventario(id_producto_fk=creado['id_producto'], cantidad_actual=10, stock_minimo=2))
    sesion.commit()
    return creado

@pytest.fixture()
def pedido(cliente, cabeceras_cliente, producto):
    cliente.post('/api/v1/carrito/items', json={'id_producto': producto['id_producto'], 'cantidad': 2}, headers=cabeceras_cliente)
    respuesta = cliente.post('/api/v1/pedidos', headers=cabeceras_cliente)
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()

def test_crear_pedido_desde_carrito(pedido):
    assert pedido['estado'] == 'Pendiente'
    assert pedido['oculto'] is False
    assert pedido['total_unidades'] == 2
    assert pedido['total'] == '60000.00'
    assert pedido['items'][0]['nombre_producto'] == 'Camisa'
    assert pedido['fecha_pedido'] is not None

def test_pedido_congela_el_precio_sin_descuento(pedido):
    item = pedido['items'][0]
    assert item['precio_lista'] == '30000.00'
    assert item['descuento_unitario'] == '0.00'
    assert item['precio_unitario'] == '30000.00'

def test_pedido_congela_el_precio_con_descuento(cliente, cabeceras_admin, cabeceras_cliente, producto):
    cliente.post('/api/v1/descuentos', json={'id_producto_fk': producto['id_producto'], 'tipo_descuento': 'PORCENTAJE', 'valor_descuento': '10.00'}, headers=cabeceras_admin)
    cliente.post('/api/v1/carrito/items', json={'id_producto': producto['id_producto'], 'cantidad': 2}, headers=cabeceras_cliente)
    cuerpo = cliente.post('/api/v1/pedidos', headers=cabeceras_cliente).json()
    item = cuerpo['items'][0]
    assert item['precio_lista'] == '30000.00'
    assert item['descuento_unitario'] == '3000.00'
    assert item['precio_unitario'] == '27000.00'
    assert item['subtotal_lista'] == '60000.00'
    assert item['descuento_total'] == '6000.00'
    assert cuerpo['total'] == '54000.00'

def test_el_precio_congelado_no_cambia_si_luego_hay_descuento(cliente, cabeceras_admin, cabeceras_cliente, producto, pedido):
    cliente.post('/api/v1/descuentos', json={'id_producto_fk': producto['id_producto'], 'tipo_descuento': 'PORCENTAJE', 'valor_descuento': '50.00'}, headers=cabeceras_admin)
    cuerpo = cliente.get(f"/api/v1/pedidos/{pedido['id_pedido']}", headers=cabeceras_cliente).json()
    assert cuerpo['items'][0]['precio_unitario'] == '30000.00'
    assert cuerpo['total'] == '60000.00'

def test_crear_cierra_el_carrito(cliente, cabeceras_cliente, pedido):
    cuerpo = cliente.get('/api/v1/carrito', headers=cabeceras_cliente).json()
    assert cuerpo['items'] == []
    assert cuerpo['id_carrito'] != 0

def test_crear_sin_carrito_da_400(cliente, cabeceras_cliente):
    respuesta = cliente.post('/api/v1/pedidos', headers=cabeceras_cliente)
    assert respuesta.status_code == 400
    assert 'carrito' in respuesta.json()['detalle'].lower()

def test_crear_con_carrito_vacio_da_400(cliente, cabeceras_cliente):
    cliente.get('/api/v1/carrito', headers=cabeceras_cliente)
    respuesta = cliente.post('/api/v1/pedidos', headers=cabeceras_cliente)
    assert respuesta.status_code == 400
    assert 'vacio' in respuesta.json()['detalle'].lower()

def test_crear_sin_token_da_401(cliente):
    assert cliente.post('/api/v1/pedidos').status_code == 401

def test_revalida_stock_al_crear(cliente, cabeceras_cliente, producto, sesion):
    cliente.post('/api/v1/carrito/items', json={'id_producto': producto['id_producto'], 'cantidad': 5}, headers=cabeceras_cliente)
    fila = sesion.query(Inventario).first()
    fila.cantidad_actual = 1
    sesion.commit()
    respuesta = cliente.post('/api/v1/pedidos', headers=cabeceras_cliente)
    assert respuesta.status_code == 400
    assert 'Stock insuficiente' in respuesta.json()['detalle']

def test_no_crea_pedido_a_medias_si_falta_stock(cliente, cabeceras_admin, cabeceras_cliente, producto, sesion):
    otro = cliente.post('/api/v1/productos', json={'nombre': 'Casco', 'precio': '20000.00'}, headers=cabeceras_admin).json()
    sesion.add(Inventario(id_producto_fk=otro['id_producto'], cantidad_actual=1, stock_minimo=0))
    sesion.commit()
    for producto_actual, cantidad in ((producto, 1), (otro, 1)):
        cliente.post('/api/v1/carrito/items', json={'id_producto': producto_actual['id_producto'], 'cantidad': cantidad}, headers=cabeceras_cliente)
    fila = sesion.query(Inventario).filter(Inventario.id_producto_fk == otro['id_producto']).first()
    fila.cantidad_actual = 0
    sesion.commit()
    assert cliente.post('/api/v1/pedidos', headers=cabeceras_cliente).status_code == 400
    assert sesion.query(Pedido).count() == 0

def test_producto_inhabilitado_impide_finalizar(cliente, cabeceras_admin, cabeceras_cliente, producto):
    cliente.post('/api/v1/carrito/items', json={'id_producto': producto['id_producto'], 'cantidad': 1}, headers=cabeceras_cliente)
    cliente.post(f"/api/v1/productos/{producto['id_producto']}/inhabilitar", headers=cabeceras_admin)
    respuesta = cliente.post('/api/v1/pedidos', headers=cabeceras_cliente)
    assert respuesta.status_code == 400
    assert 'inhabilitado' in respuesta.json()['detalle']

def test_cliente_ve_solo_sus_pedidos(cliente, cabeceras_cliente, cabeceras_otro, pedido):
    mios = cliente.get('/api/v1/pedidos', headers=cabeceras_cliente).json()
    ajenos = cliente.get('/api/v1/pedidos', headers=cabeceras_otro).json()
    assert mios['total'] == 1
    assert ajenos['total'] == 0

def test_admin_ve_todos_los_pedidos(cliente, cabeceras_admin, pedido):
    cuerpo = cliente.get('/api/v1/pedidos', headers=cabeceras_admin).json()
    assert cuerpo['total'] == 1
    assert cuerpo['items'][0]['id_pedido'] == pedido['id_pedido']

def test_vendedor_ve_todos_los_pedidos(cliente, cabeceras_vendedor, pedido):
    cuerpo = cliente.get('/api/v1/pedidos', headers=cabeceras_vendedor).json()
    assert cuerpo['total'] == 1

def test_filtro_por_estado(cliente, cabeceras_admin, pedido):
    assert cliente.get('/api/v1/pedidos?estado=Pendiente', headers=cabeceras_admin).json()['total'] == 1
    assert cliente.get('/api/v1/pedidos?estado=Entregado', headers=cabeceras_admin).json()['total'] == 0

def test_detalle_propio(cliente, cabeceras_cliente, pedido):
    respuesta = cliente.get(f"/api/v1/pedidos/{pedido['id_pedido']}", headers=cabeceras_cliente)
    assert respuesta.status_code == 200
    assert respuesta.json()['id_pedido'] == pedido['id_pedido']

def test_detalle_ajeno_da_404(cliente, cabeceras_otro, pedido):
    respuesta = cliente.get(f"/api/v1/pedidos/{pedido['id_pedido']}", headers=cabeceras_otro)
    assert respuesta.status_code == 404

def test_detalle_inexistente_da_404(cliente, cabeceras_admin):
    assert cliente.get('/api/v1/pedidos/9999', headers=cabeceras_admin).status_code == 404

def test_flujo_completo_pendiente_enviado_entregado(cliente, cabeceras_admin, pedido):
    r1 = cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': 'Enviado'}, headers=cabeceras_admin)
    assert r1.status_code == 200
    assert r1.json()['estado'] == 'Enviado'
    assert r1.json()['oculto'] is False
    r2 = cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': 'Entregado'}, headers=cabeceras_admin)
    assert r2.status_code == 200
    assert r2.json()['estado'] == 'Entregado'
    assert r2.json()['oculto'] is True

def test_no_se_puede_saltar_de_pendiente_a_entregado(cliente, cabeceras_admin, pedido):
    respuesta = cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': 'Entregado'}, headers=cabeceras_admin)
    assert respuesta.status_code == 400
    assert 'Enviado' in respuesta.json()['detalle']

def test_entregado_es_final(cliente, cabeceras_admin, pedido):
    for estado in ('Enviado', 'Entregado'):
        cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': estado}, headers=cabeceras_admin)
    respuesta = cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': 'Cancelado'}, headers=cabeceras_admin)
    assert respuesta.status_code == 409

def test_mismo_estado_da_409(cliente, cabeceras_admin, pedido):
    respuesta = cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': 'Pendiente'}, headers=cabeceras_admin)
    assert respuesta.status_code == 409

def test_estado_invalido_da_422(cliente, cabeceras_admin, pedido):
    respuesta = cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': 'Perdido'}, headers=cabeceras_admin)
    assert respuesta.status_code == 422

def test_cliente_no_puede_cambiar_estado(cliente, cabeceras_cliente, pedido):
    respuesta = cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': 'Enviado'}, headers=cabeceras_cliente)
    assert respuesta.status_code == 403

def test_vendedor_puede_cambiar_estado(cliente, cabeceras_vendedor, pedido):
    respuesta = cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': 'Enviado'}, headers=cabeceras_vendedor)
    assert respuesta.status_code == 200

def test_entregar_descuenta_inventario(cliente, cabeceras_admin, cabeceras_cliente, producto, pedido, sesion):
    fila = sesion.query(Inventario).filter(Inventario.id_producto_fk == producto['id_producto']).first()
    assert fila.cantidad_actual == 10
    for estado in ('Enviado', 'Entregado'):
        cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': estado}, headers=cabeceras_admin)
    sesion.expire_all()
    fila = sesion.query(Inventario).filter(Inventario.id_producto_fk == producto['id_producto']).first()
    assert fila.cantidad_actual == 8

def test_entregar_registra_el_movimiento(cliente, cabeceras_admin, pedido, sesion):
    for estado in ('Enviado', 'Entregado'):
        cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': estado}, headers=cabeceras_admin)
    movimientos = sesion.query(MovimientoInventario).all()
    assert len(movimientos) == 1
    assert movimientos[0].tipo_movimiento == 'SALIDA'
    assert movimientos[0].cantidad == 2
    assert f"Pedido #{pedido['id_pedido']}" in movimientos[0].motivo

def test_entregar_reparte_entre_varias_filas(cliente, cabeceras_admin, cabeceras_cliente, producto, sesion):
    sesion.add(Inventario(id_producto_fk=producto['id_producto'], cantidad_actual=1, stock_minimo=0))
    sesion.commit()
    cliente.post('/api/v1/carrito/items', json={'id_producto': producto['id_producto'], 'cantidad': 3}, headers=cabeceras_cliente)
    pedido = cliente.post('/api/v1/pedidos', headers=cabeceras_cliente).json()
    for estado in ('Enviado', 'Entregado'):
        cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': estado}, headers=cabeceras_admin)
    sesion.expire_all()
    filas = sesion.query(Inventario).filter(Inventario.id_producto_fk == producto['id_producto']).all()
    assert sum((f.cantidad_actual for f in filas)) == 8

def test_entregar_sin_stock_suficiente_da_400_y_no_cambia_estado(cliente, cabeceras_admin, cabeceras_cliente, producto, sesion):
    cliente.post('/api/v1/carrito/items', json={'id_producto': producto['id_producto'], 'cantidad': 5}, headers=cabeceras_cliente)
    pedido = cliente.post('/api/v1/pedidos', headers=cabeceras_cliente).json()
    cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': 'Enviado'}, headers=cabeceras_admin)
    fila = sesion.query(Inventario).first()
    fila.cantidad_actual = 1
    sesion.commit()
    respuesta = cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': 'Entregado'}, headers=cabeceras_admin)
    assert respuesta.status_code == 400
    assert 'Stock insuficiente' in respuesta.json()['detalle']
    cuerpo = cliente.get(f"/api/v1/pedidos/{pedido['id_pedido']}", headers=cabeceras_admin).json()
    assert cuerpo['estado'] == 'Enviado'

def test_entregar_deja_alerta_si_baja_del_minimo(cliente, cabeceras_admin, cabeceras_cliente, producto, sesion):
    fila = sesion.query(Inventario).first()
    fila.stock_minimo = 8
    sesion.commit()
    cliente.post('/api/v1/carrito/items', json={'id_producto': producto['id_producto'], 'cantidad': 3}, headers=cabeceras_cliente)
    pedido = cliente.post('/api/v1/pedidos', headers=cabeceras_cliente).json()
    for estado in ('Enviado', 'Entregado'):
        cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': estado}, headers=cabeceras_admin)
    alertas = cliente.get('/api/v1/inventario/alertas', headers=cabeceras_admin).json()
    assert alertas['total'] == 1
    assert alertas['items'][0]['nivel_stock'] == 7

def test_cliente_cancela_su_pedido_pendiente(cliente, cabeceras_cliente, pedido):
    respuesta = cliente.post(f"/api/v1/pedidos/{pedido['id_pedido']}/cancelar", headers=cabeceras_cliente)
    assert respuesta.status_code == 200
    assert respuesta.json()['estado'] == 'Cancelado'

def test_cliente_no_cancela_un_pedido_enviado(cliente, cabeceras_admin, cabeceras_cliente, pedido):
    cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': 'Enviado'}, headers=cabeceras_admin)
    respuesta = cliente.post(f"/api/v1/pedidos/{pedido['id_pedido']}/cancelar", headers=cabeceras_cliente)
    assert respuesta.status_code == 403

def test_no_cancela_pedido_ajeno(cliente, cabeceras_otro, pedido):
    respuesta = cliente.post(f"/api/v1/pedidos/{pedido['id_pedido']}/cancelar", headers=cabeceras_otro)
    assert respuesta.status_code == 404

def test_admin_cancela_un_pedido_enviado(cliente, cabeceras_admin, pedido):
    cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': 'Enviado'}, headers=cabeceras_admin)
    respuesta = cliente.post(f"/api/v1/pedidos/{pedido['id_pedido']}/cancelar", headers=cabeceras_admin)
    assert respuesta.status_code == 200
    assert respuesta.json()['estado'] == 'Cancelado'

def test_cancelar_no_devuelve_inventario_ni_borra(cliente, cabeceras_cliente, producto, sesion):
    cliente.post('/api/v1/carrito/items', json={'id_producto': producto['id_producto'], 'cantidad': 2}, headers=cabeceras_cliente)
    pedido = cliente.post('/api/v1/pedidos', headers=cabeceras_cliente).json()
    cliente.post(f"/api/v1/pedidos/{pedido['id_pedido']}/cancelar", headers=cabeceras_cliente)
    fila = sesion.query(Inventario).first()
    assert fila.cantidad_actual == 10
    assert sesion.query(Pedido).count() == 1

def test_cancelar_pedido_entregado_da_409(cliente, cabeceras_admin, pedido):
    for estado in ('Enviado', 'Entregado'):
        cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': estado}, headers=cabeceras_admin)
    respuesta = cliente.post(f"/api/v1/pedidos/{pedido['id_pedido']}/cancelar", headers=cabeceras_admin)
    assert respuesta.status_code == 409

def test_cliente_no_ve_sus_pedidos_entregados(cliente, cabeceras_admin, cabeceras_cliente, pedido):
    for estado in ('Enviado', 'Entregado'):
        cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': estado}, headers=cabeceras_admin)
    assert cliente.get('/api/v1/pedidos', headers=cabeceras_cliente).json()['total'] == 0
    con_ocultos = cliente.get('/api/v1/pedidos?incluir_ocultos=true', headers=cabeceras_cliente).json()
    assert con_ocultos['total'] == 1

def test_admin_si_ve_los_entregados(cliente, cabeceras_admin, pedido):
    for estado in ('Enviado', 'Entregado'):
        cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': estado}, headers=cabeceras_admin)
    assert cliente.get('/api/v1/pedidos', headers=cabeceras_admin).json()['total'] == 1

def test_cliente_puede_consultar_su_pedido_entregado_por_id(cliente, cabeceras_admin, cabeceras_cliente, pedido):
    for estado in ('Enviado', 'Entregado'):
        cliente.patch(f"/api/v1/pedidos/{pedido['id_pedido']}/estado", json={'estado': estado}, headers=cabeceras_admin)
    respuesta = cliente.get(f"/api/v1/pedidos/{pedido['id_pedido']}", headers=cabeceras_cliente)
    assert respuesta.status_code == 200
    assert respuesta.json()['oculto'] is True
