"""Permisos y operación de carga masiva de inventario para Bodega."""
from io import BytesIO

import pytest
from openpyxl import load_workbook
from sqlalchemy import select

from app.core.security import crear_token_acceso
from app.models.inventario import Inventario
from app.models.movimiento_inventario import MovimientoInventario
from app.models.producto import Producto
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from app.services.carga_masiva import plantilla

BASE = '/api/v1/cargas-masivas'


@pytest.fixture
def credenciales(sesion):
    for rol in range(1, 5):
        sesion.add(Rol(id_rol=rol, nombre_rol=f'Rol {rol}', activo=True))
    sesion.flush()
    cuentas = {}
    for rol in range(1, 5):
        u = Usuario(nombre=f'Usuario {rol}', correo=f'rol{rol}@prueba.com',
                    password='hash', estado='Habilitado', id_rol_fk=rol)
        sesion.add(u)
        sesion.flush()
        sesion.add(UsuarioRol(id_usuario_fk=u.id_usuario, id_rol_fk=rol, activo=True))
        cuentas[rol] = {'Authorization': 'Bearer ' + crear_token_acceso(u.id_usuario, rol)}
    sesion.commit()
    return cuentas


def archivo(filas):
    libro = load_workbook(BytesIO(plantilla('inventario')))
    for fila in filas:
        libro['Datos'].append(fila)
    salida = BytesIO()
    libro.save(salida)
    return {'archivo': ('inventario.xlsx', salida.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}


@pytest.mark.parametrize('rol,tipo,esperado', [
    (1, 'inventario', 200), (1, 'productos', 200), (1, 'usuarios', 200),
    (4, 'inventario', 200), (4, 'productos', 403), (4, 'usuarios', 403),
    (2, 'inventario', 403), (2, 'productos', 403), (2, 'usuarios', 403),
    (3, 'inventario', 403), (3, 'productos', 403), (3, 'usuarios', 403),
])
def test_permisos_plantilla(cliente, credenciales, rol, tipo, esperado):
    r = cliente.get(f'{BASE}/{tipo}/plantilla', headers=credenciales[rol])
    assert r.status_code == esperado


@pytest.mark.parametrize('rol,tipo', [(4,'productos'), (4,'usuarios'), (2,'inventario'), (3,'inventario')])
@pytest.mark.parametrize('guardar', ['true', 'false'])
def test_roles_no_autorizados_no_pueden_subir(cliente, credenciales, rol, tipo, guardar):
    r = cliente.post(f'{BASE}/{tipo}?guardar={guardar}', headers=credenciales[rol], files=archivo([[1,5,None]]))
    assert r.status_code == 403


def test_anonimo_no_accede(cliente):
    assert cliente.get(f'{BASE}/inventario/plantilla').status_code == 401
    assert cliente.post(f'{BASE}/inventario', files=archivo([[1,5,None]])).status_code == 401


def test_bodeguero_valida_confirma_suma_y_registra_movimiento(cliente, sesion, credenciales):
    p = Producto(nombre='Producto de prueba', precio=100, categoria='General', inhabilitado=False)
    sesion.add(p); sesion.flush()
    i = Inventario(id_producto_fk=p.id_producto, cantidad_actual=10, stock_minimo=2, inhabilitado=False)
    sesion.add(i); sesion.commit()
    ruta = f'{BASE}/inventario'
    contenido = archivo([[p.id_producto, 5, None]])
    r = cliente.post(ruta + '?guardar=false', headers=credenciales[4], files=contenido)
    assert r.json() == {'total': 1, 'validos': 1, 'errores': [], 'guardados': 0}
    sesion.refresh(i); assert i.cantidad_actual == 10
    r = cliente.post(ruta + '?guardar=true', headers=credenciales[4], files=contenido)
    assert r.json()['guardados'] == 1
    sesion.refresh(i); assert i.cantidad_actual == 15
    mov = sesion.scalar(select(MovimientoInventario).where(MovimientoInventario.id_inventario == i.id_inventario))
    assert mov and mov.cantidad == 5 and mov.tipo_movimiento == 'ENTRADA'
    assert mov.usuario_responsable == 'Usuario 4'


def test_archivo_con_error_no_actualiza_inventario(cliente, sesion, credenciales):
    p = Producto(nombre='Producto', precio=100, categoria='General', inhabilitado=False)
    sesion.add(p); sesion.flush()
    i = Inventario(id_producto_fk=p.id_producto, cantidad_actual=10, stock_minimo=2, inhabilitado=False)
    sesion.add(i); sesion.commit()
    r = cliente.post(f'{BASE}/inventario?guardar=true', headers=credenciales[4], files=archivo([[p.id_producto, 5, None], [99999, 5, None]]))
    assert r.json()['guardados'] == 0 and r.json()['errores']
    sesion.refresh(i); assert i.cantidad_actual == 10


def test_multirrol_solo_permite_el_rol_seleccionado(cliente, sesion, credenciales):
    usuario = sesion.scalar(select(Usuario).where(Usuario.correo == 'rol4@prueba.com'))
    sesion.add(UsuarioRol(id_usuario_fk=usuario.id_usuario, id_rol_fk=1, activo=True)); sesion.commit()
    assert cliente.get(f'{BASE}/productos/plantilla', headers=credenciales[4]).status_code == 403
    como_admin = {'Authorization': 'Bearer ' + crear_token_acceso(usuario.id_usuario, 1)}
    assert cliente.get(f'{BASE}/productos/plantilla', headers=como_admin).status_code == 200
