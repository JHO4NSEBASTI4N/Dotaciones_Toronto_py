"""Agregador de routers de la version 1 de la API."""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, inventario, producto

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Autenticacion"])
api_router.include_router(producto.router, prefix="/productos", tags=["Productos"])
api_router.include_router(inventario.router, prefix="/inventario", tags=["Inventario"])
