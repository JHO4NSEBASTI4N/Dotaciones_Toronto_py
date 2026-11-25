from io import BytesIO
from openpyxl import load_workbook
from sqlalchemy import select
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.producto import Producto
from app.models.inventario import Inventario
from app.models.movimiento_inventario import MovimientoInventario
from app.core.security import hashear_password
from app.models.usuario_rol import UsuarioRol

def acceso(cliente, sesion, rol=1):
    for i, nombre in [(1, 'Administrador'), (2, 'Cliente'), (3, 'Bodeguero')]:
        if not sesion.get(Rol, i): sesion.add(Rol(id_rol=i, nombre_rol=nombre, activo=True))
    sesion.flush()
    usuario = Usuario(nombre='Admin', correo=f'rol{rol}@ejemplo.com', password=hashear_password('secreta123'), estado='Habilitado', id_rol_fk=rol)
    sesion.add(usuario); sesion.flush()
    sesion.add(UsuarioRol(id_usuario_fk=usuario.id_usuario, id_rol_fk=rol, activo=True)); sesion.commit()
    respuesta = cliente.post('/api/v1/auth/login', json={'correo': usuario.correo, 'password': 'secreta123'})
    return {'Authorization': 'Bearer ' + respuesta.json()['access_token']}

def xlsx(cliente, headers, tipo, filas):
    r = cliente.get(f'/api/v1/cargas-masivas/{tipo}/plantilla', headers=headers)
    assert r.status_code == 200
    libro = load_workbook(BytesIO(r.content)); hoja = libro['Datos']
    for fila in filas: hoja.append(fila)
    salida = BytesIO(); libro.save(salida); return salida.getvalue()

def enviar(cliente, headers, tipo, contenido, guardar=False):
    return cliente.post(f'/api/v1/cargas-masivas/{tipo}?guardar={str(guardar).lower()}', headers=headers, files={'archivo': ('datos.xlsx', contenido, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')})

def test_roles_y_plantillas(cliente, sesion):
    admin = acceso(cliente, sesion)
    cliente_h = acceso(cliente, sesion, 2)
    assert cliente.get('/api/v1/cargas-masivas/productos/plantilla').status_code == 401
    assert cliente.get('/api/v1/cargas-masivas/productos/plantilla', headers=cliente_h).status_code == 403
    for tipo in ['productos', 'inventario', 'usuarios']:
        assert cliente.get(f'/api/v1/cargas-masivas/{tipo}/plantilla', headers=admin).status_code == 200

def test_productos_valida_sin_guardar_y_luego_guarda(cliente, sesion):
    h = acceso(cliente, sesion)
    archivo = xlsx(cliente, h, 'productos', [['Camisa prueba', 50000, 'Camisas', 'M', 'Blanco', None]])
    assert enviar(cliente, h, 'productos', archivo).json() == {'total':1, 'validos':1, 'errores':[], 'guardados':0}
    assert sesion.scalar(select(Producto).where(Producto.nombre == 'Camisa prueba')) is None
    assert enviar(cliente, h, 'productos', archivo, True).json()['guardados'] == 1
    assert sesion.scalar(select(Producto).where(Producto.nombre == 'Camisa prueba')) is not None
    assert enviar(cliente, h, 'productos', archivo, True).json()['errores']

def test_fila_invalida_impide_todas_las_filas(cliente, sesion):
    h = acceso(cliente, sesion)
    archivo = xlsx(cliente, h, 'productos', [['Camisa nueva', 20, 'General'], ['Producto malo', -1, 'General']])
    datos = enviar(cliente, h, 'productos', archivo, True).json()
    assert datos['guardados'] == 0 and datos['errores'][0]['fila'] == 3
    assert sesion.scalar(select(Producto).where(Producto.nombre == 'Camisa nueva')) is None

def test_inventario_suma_y_registra_movimiento(cliente, sesion):
    h = acceso(cliente, sesion)
    p = Producto(nombre='Camisa', precio=100, categoria='General', inhabilitado=False)
    sesion.add(p); sesion.flush()
    i = Inventario(id_producto_fk=p.id_producto, cantidad_actual=10, stock_minimo=2, inhabilitado=False)
    sesion.add(i); sesion.commit()
    archivo = xlsx(cliente, h, 'inventario', [[p.id_producto, 5, None]])
    assert enviar(cliente, h, 'inventario', archivo, True).json()['guardados'] == 1
    sesion.refresh(i); assert i.cantidad_actual == 15
    mov = sesion.scalar(select(MovimientoInventario).where(MovimientoInventario.id_inventario == i.id_inventario))
    assert mov.cantidad == 5 and mov.tipo_movimiento == 'ENTRADA'

def test_usuario_rol_y_password_privado(cliente, sesion):
    h = acceso(cliente, sesion)
    archivo = xlsx(cliente, h, 'usuarios', [['Persona Prueba', 'persona@ejemplo.com', '12345678', None, None, 2]])
    r = enviar(cliente, h, 'usuarios', archivo, True)
    assert r.json()['guardados'] == 1
    persona = sesion.scalar(select(Usuario).where(Usuario.correo == 'persona@ejemplo.com'))
    assert persona and persona.id_rol_fk == 2 and persona.password.startswith('$2')
    assert sesion.scalar(select(UsuarioRol).where(UsuarioRol.id_usuario_fk == persona.id_usuario)).activo
    r = cliente.post(f'/api/v1/usuarios/{persona.id_usuario}/restablecer-password', headers=h, json={'password_nueva':'CambiA123!'})
    assert r.status_code == 200
    assert cliente.post('/api/v1/auth/login', json={'correo':persona.correo, 'password':'CambiA123!'}).status_code == 200

def test_xlsx_formula_rechazada_y_columnas_invalidas(cliente, sesion):
    h = acceso(cliente, sesion)
    archivo = xlsx(cliente, h, 'productos', [['=1+1', 100, 'General']])
    assert enviar(cliente, h, 'productos', archivo, True).json()['errores'][0]['fila'] == 2
    assert enviar(cliente, h, 'productos', b'no es excel').status_code == 400
    archivo2 = xlsx(cliente, h, 'productos', [[None, 100, 'General']])
    assert enviar(cliente, h, 'productos', archivo2).json()['errores'][0]['fila'] == 2

def test_inventario_nuevo_y_error_de_producto(cliente, sesion):
    h = acceso(cliente, sesion)
    producto = Producto(nombre='Pantalon nuevo', precio=100, categoria='General', inhabilitado=False)
    sesion.add(producto); sesion.commit()
    archivo_malo = xlsx(cliente, h, 'inventario', [[producto.id_producto, 3, 1], [999999, 3, 1]])
    datos = enviar(cliente, h, 'inventario', archivo_malo, True).json()
    assert datos['guardados'] == 0 and datos['errores'][0]['fila'] == 3
    assert sesion.scalar(select(Inventario).where(Inventario.id_producto_fk == producto.id_producto)) is None
    archivo = xlsx(cliente, h, 'inventario', [[producto.id_producto, 3, 1]])
    assert enviar(cliente, h, 'inventario', archivo, True).json()['guardados'] == 1
    registro = sesion.scalar(select(Inventario).where(Inventario.id_producto_fk == producto.id_producto))
    assert registro.cantidad_actual == 3 and registro.stock_minimo == 1

def test_solo_administrador_puede_cargar(cliente, sesion):
    h = acceso(cliente, sesion, 2)
    respuesta = enviar(cliente, h, 'usuarios', b'no importa', True)
    assert respuesta.status_code == 403

def test_usuario_correo_repetido_no_guarda_ninguno(cliente, sesion):
    h = acceso(cliente, sesion)
    archivo = xlsx(cliente, h, 'usuarios', [['Persona Nueva', 'nuevo@ejemplo.com', None, None, None, 2], ['Repetida', 'NUEVO@ejemplo.com', None, None, None, 2]])
    r = enviar(cliente, h, 'usuarios', archivo, True).json()
    assert r['guardados'] == 0 and r['errores'][0]['fila'] == 3
    assert sesion.scalar(select(Usuario).where(Usuario.correo == 'nuevo@ejemplo.com')) is None

def test_usuario_cargado_puede_recuperar_contrasena(cliente, sesion, monkeypatch):
    """Las cuentas importadas pueden usar el flujo de recuperación recién integrado."""
    from app.services import recuperacion
    from app.api.v1.endpoints import recuperacion as endpoint_recuperacion
    with endpoint_recuperacion._lock:
        endpoint_recuperacion._registros.clear()
    enviados = []
    monkeypatch.setattr(recuperacion, 'enviar_codigo', lambda correo, codigo: enviados.append((correo, codigo)))
    h = acceso(cliente, sesion)
    archivo = xlsx(cliente, h, 'usuarios', [['Usuario Importado', 'importado@ejemplo.com', None, None, None, 2]])
    assert enviar(cliente, h, 'usuarios', archivo, True).json()['guardados'] == 1
    base = '/api/v1/auth/recuperacion'
    correo = 'importado@ejemplo.com'
    assert cliente.post(base + '/solicitar', json={'correo': correo}).status_code == 200
    assert len(enviados) == 1 and enviados[0][0] == correo
    respuesta = cliente.post(base + '/verificar', json={'correo': correo, 'codigo': enviados[0][1]})
    assert respuesta.status_code == 200
    respuesta = cliente.post(base + '/cambiar', json={'correo': correo, 'ticket': respuesta.json()['ticket'], 'password_nueva': 'ClaveNueva123!'})
    assert respuesta.status_code == 200
    assert cliente.post('/api/v1/auth/login', json={'correo': correo, 'password': 'ClaveNueva123!'}).status_code == 200
    with endpoint_recuperacion._lock:
        endpoint_recuperacion._registros.clear()
