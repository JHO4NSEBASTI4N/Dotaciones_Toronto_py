"""Modelos ORM de la base de datos dotaciones Toronto.

Este __init__ importa TODOS los modelos a proposito. SQLAlchemy resuelve los
`relationship()` por nombre de clase en un registro global; si un modelo no ha
sido importado cuando se configura el mapper, falla con:

    InvalidRequestError: expression 'Pedido' failed to locate a name

Importar aqui garantiza que `import app.models` deje el mapeo completo listo.
"""

from app.models.alerta_stock import AlertaStock
from app.models.carrito import Carrito
from app.models.detalle_carrito import DetalleCarrito
from app.models.detalle_pedido import DetallePedido
from app.models.descuento import Descuento
from app.models.detalle_venta import DetalleVenta
from app.models.devolucion import Devolucion
from app.models.factura import Factura
from app.models.inventario import Inventario
from app.models.movimiento_inventario import MovimientoInventario
from app.models.pedido import Pedido
from app.models.producto import Producto
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from app.models.venta import Venta

__all__ = [
    "AlertaStock",
    "Carrito",
    "DetalleCarrito",
    "DetallePedido",
    "Descuento",
    "DetalleVenta",
    "Devolucion",
    "Factura",
    "Inventario",
    "MovimientoInventario",
    "Pedido",
    "Producto",
    "Rol",
    "Usuario",
    "UsuarioRol",
    "Venta",
]
