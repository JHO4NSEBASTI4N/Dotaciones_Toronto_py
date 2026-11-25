"""Validacion y aplicacion atomica de cargas XLSX administrativas."""
from io import BytesIO
from secrets import token_urlsafe
from zipfile import ZipFile

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.exceptions import ReglaNegocio
from app.core.security import hashear_password
from app.models.producto import Producto
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from app.models.rol import Rol
from app.models.inventario import Inventario
from app.repositories.producto import ProductoRepositorio
from app.repositories.inventario import InventarioRepositorio
from app.schemas.producto import ProductoCrear
from app.schemas.usuario import UsuarioCrear
from app.schemas.inventario import InventarioCrear
from app.services.inventario import _verificar_alerta
from app.services.producto import _esta_inhabilitado

COLUMNAS = {
    'productos': ['nombre', 'precio', 'categoria', 'talla', 'color', 'imagen'],
    'inventario': ['id_producto', 'cantidad', 'stock_minimo'],
    'usuarios': ['nombre', 'correo', 'documento', 'telefono', 'direccion', 'id_rol'],
}
MAX_FILAS = 500
MAX_ARCHIVO = 2 * 1024 * 1024
MAX_DESCOMPRIMIDO = 20 * 1024 * 1024


def plantilla(tipo: str) -> bytes:
    libro = Workbook()
    hoja = libro.active
    hoja.title = 'Datos'
    hoja.append(COLUMNAS[tipo])
    for celda in hoja[1]:
        celda.font = Font(bold=True, color='FFFFFF')
        celda.fill = PatternFill('solid', fgColor='176B63')
        hoja.column_dimensions[celda.column_letter].width = 24
    hoja.freeze_panes = 'A2'
    instrucciones = libro.create_sheet('Instrucciones')
    texto = {
        'productos': 'Obligatorios: nombre y precio. Categoria opcional (General por defecto). Talla, color e imagen opcionales. Cada fila crea un producto nuevo; no incluir nombres existentes.',
        'inventario': 'Obligatorios: id_producto y cantidad positiva a SUMAR. stock_minimo es opcional y se usa solo al crear inventario nuevo. Cada producto debe existir y estar habilitado. No repetir IDs.',
        'usuarios': 'Obligatorios: nombre, correo e id_rol activo. Documento, telefono y direccion opcionales (guardar como texto para conservar ceros). No poner contrasenas en el Excel. El administrador debe restablecerlas individualmente.',
    }
    instrucciones['A1'] = texto[tipo]
    instrucciones.column_dimensions['A'].width = 100
    instrucciones['A1'].alignment = Alignment(wrap_text=True)
    instrucciones.row_dimensions[1].height = 75
    salida = BytesIO()
    libro.save(salida)
    return salida.getvalue()


def _leer(tipo: str, contenido: bytes):
    if not contenido or len(contenido) > MAX_ARCHIVO:
        raise ReglaNegocio('El archivo debe pesar entre 1 byte y 2 MB.')
    try:
        with ZipFile(BytesIO(contenido)) as archivo:
            if len(archivo.infolist()) > 500 or sum(x.file_size for x in archivo.infolist()) > MAX_DESCOMPRIMIDO:
                raise ReglaNegocio('El archivo Excel es demasiado grande al descomprimirse.')
        libro = load_workbook(BytesIO(contenido), read_only=True, data_only=False, keep_links=False)
        hoja = libro['Datos'] if 'Datos' in libro.sheetnames else libro.active
        if hoja.max_row > MAX_FILAS + 1 or hoja.max_column > len(COLUMNAS[tipo]):
            raise ReglaNegocio('El archivo supera 500 filas o tiene columnas adicionales.')
        filas = list(hoja.iter_rows())
        if not filas or [str(c.value or '').strip().lower() for c in filas[0]] != COLUMNAS[tipo]:
            raise ReglaNegocio('Los encabezados no coinciden con la plantilla. Descarga la plantilla correspondiente.')
        resultado = []
        for numero, celdas in enumerate(filas[1:], start=2):
            if all(c.value is None or str(c.value).strip() == '' for c in celdas):
                continue
            if any(c.data_type == 'f' for c in celdas):
                resultado.append((numero, None, 'No se permiten formulas en el archivo.'))
            else:
                valores = [c.value.strip() if isinstance(c.value, str) else c.value for c in celdas]
                resultado.append((numero, dict(zip(COLUMNAS[tipo], valores)), None))
        libro.close()
    except ReglaNegocio:
        raise
    except Exception:
        raise ReglaNegocio('El archivo no es un Excel .xlsx valido.')
    if not resultado:
        raise ReglaNegocio('La plantilla no tiene filas con datos.')
    return resultado


def _entero(valor, nombre, minimo=0):
    if isinstance(valor, bool) or valor is None:
        raise ValueError(f'{nombre} debe ser un numero entero mayor o igual a {minimo}.')
    try:
        num = int(str(valor))
    except (ValueError, TypeError):
        raise ValueError(f'{nombre} debe ser un numero entero mayor o igual a {minimo}.')
    if num < minimo or num > 2147483647:
        raise ValueError(f'{nombre} esta fuera del rango permitido.')
    return num


def validar(tipo, contenido, sesion, bloquear=False):
    filas = _leer(tipo, contenido)
    errores, validos, vistos = [], [], set()
    for numero, fila, error in filas:
        try:
            if error:
                raise ValueError(error)
            if tipo == 'productos':
                fila['categoria'] = fila.get('categoria') or 'General'
                dto = ProductoCrear(**fila)
                clave = dto.nombre.strip().casefold()
                dto.nombre = dto.nombre.strip()
                if not clave or clave in vistos or sesion.scalar(select(Producto.id_producto).where(func.lower(Producto.nombre) == clave)):
                    raise ValueError('El nombre del producto ya existe o esta repetido en el archivo.')
            elif tipo == 'usuarios':
                clave = str(fila.get('correo') or '').strip().lower()
                rol = _entero(fila.pop('id_rol'), 'id_rol', 1)
                # El usuario configura su contraseña después; aun así el secreto
                # temporal debe cumplir las mismas reglas del esquema.
                dto = UsuarioCrear(**fila, password=token_urlsafe(32) + "A1!")
                dto.correo = str(dto.correo).lower()
                rol_db = sesion.get(Rol, rol)
                if not rol_db or not rol_db.activo:
                    raise ValueError('El id_rol no existe o esta desactivado.')
                if clave in vistos or sesion.scalar(select(Usuario.id_usuario).where(func.lower(Usuario.correo) == clave)):
                    raise ValueError('El correo ya existe o esta repetido en el archivo.')
                dto = (dto, rol)
            else:
                clave = _entero(fila['id_producto'], 'id_producto', 1)
                cantidad = _entero(fila['cantidad'], 'cantidad', 1)
                minimo = None if fila['stock_minimo'] in (None, '') else _entero(fila['stock_minimo'], 'stock_minimo')
                consulta = select(Producto).where(Producto.id_producto == clave)
                if bloquear:
                    consulta = consulta.with_for_update()
                producto = sesion.scalar(consulta)
                if not producto or _esta_inhabilitado(producto.inhabilitado):
                    raise ValueError('El producto no existe o esta inhabilitado.')
                if clave in vistos:
                    raise ValueError('El producto esta repetido en el archivo.')
                existentes = InventarioRepositorio(sesion).listar_por_producto(clave)
                activas = [x for x in existentes if not _esta_inhabilitado(x.inhabilitado)]
                if existentes and not activas:
                    raise ValueError('El inventario del producto esta inhabilitado.')
                if activas and minimo is not None:
                    raise ValueError('stock_minimo solo se indica para inventario nuevo; dejalo vacio.')
                if activas and (activas[0].cantidad_actual or 0) + cantidad > 2147483647:
                    raise ValueError('La cantidad final supera el limite permitido.')
                dto = (producto, cantidad, minimo)
            vistos.add(clave)
            validos.append((numero, dto))
        except ValidationError as exc:
            mensajes = [f"{'.'.join(map(str,e['loc']))}: {e['msg']}" for e in exc.errors(include_input=False)]
            errores.append({'fila': numero, 'mensaje': '; '.join(mensajes)})
        except (ValueError, TypeError) as exc:
            errores.append({'fila': numero, 'mensaje': str(exc)})
    return validos, errores, len(filas)


def procesar(tipo, contenido, sesion, guardar, responsable):
    try:
        validos, errores, total = validar(tipo, contenido, sesion, bloquear=guardar)
        if errores or not guardar:
            return {'total': total, 'validos': len(validos), 'errores': errores, 'guardados': 0}
        for _, dto in validos:
            if tipo == 'productos':
                ProductoRepositorio(sesion).crear(dto)
            elif tipo == 'usuarios':
                datos, rol = dto
                usuario = Usuario(**datos.model_dump(exclude={'password'}), password=hashear_password(datos.password), estado='Habilitado', id_rol_fk=rol)
                sesion.add(usuario)
                sesion.flush()
                sesion.add(UsuarioRol(id_usuario_fk=usuario.id_usuario, id_rol_fk=rol, activo=True))
            else:
                producto, cantidad, minimo = dto
                repo = InventarioRepositorio(sesion)
                filas = [x for x in repo.listar_por_producto(producto.id_producto) if not _esta_inhabilitado(x.inhabilitado)]
                if filas:
                    fila = sesion.scalar(select(Inventario).where(Inventario.id_inventario == filas[0].id_inventario).with_for_update())
                    if (fila.cantidad_actual or 0) + cantidad > 2147483647:
                        raise ReglaNegocio('El stock final supera el limite permitido; no se guardo ninguna fila.')
                    fila.cantidad_actual = (fila.cantidad_actual or 0) + cantidad
                else:
                    fila = repo.crear(InventarioCrear(id_producto_fk=producto.id_producto, cantidad_actual=cantidad, stock_minimo=minimo or 0))
                repo.registrar_movimiento(fila.id_inventario, producto.nombre, 'ENTRADA', cantidad, 'Carga masiva Excel', responsable)
                sesion.flush()
                todas = [f for f in repo.listar_por_producto(producto.id_producto) if not _esta_inhabilitado(f.inhabilitado)]
                stock_total = sum(f.cantidad_actual or 0 for f in todas)
                minimo_total = max((f.stock_minimo or 0 for f in todas), default=0)
                _verificar_alerta(repo, fila.id_producto_fk, stock_total, minimo_total)
        sesion.commit()
        return {'total': total, 'validos': total, 'errores': [], 'guardados': total}
    except IntegrityError:
        sesion.rollback()
        raise ReglaNegocio('No se guardo la carga: un dato ya existe o cambio durante la operacion. Vuelve a validar.')
    except Exception:
        sesion.rollback()
        raise
