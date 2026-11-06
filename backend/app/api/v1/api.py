from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    carrito,
    descuento,
    devolucion,
    inventario,
    pedido,
    producto,
    venta,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Autenticacion"])
api_router.include_router(producto.router, prefix="/productos", tags=["Productos"])
api_router.include_router(inventario.router, prefix="/inventario", tags=["Inventario"])
api_router.include_router(descuento.router, prefix="/descuentos", tags=["Descuentos"])
api_router.include_router(carrito.router, prefix="/carrito", tags=["Carrito"])
api_router.include_router(pedido.router, prefix="/pedidos", tags=["Pedidos"])
api_router.include_router(venta.router, prefix="/ventas", tags=["Ventas"])
api_router.include_router(
    devolucion.router, prefix="/devoluciones", tags=["Devoluciones"]
)