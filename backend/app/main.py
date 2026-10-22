from fastapi import FastAPI

from app.api.v1.api import api_router
from app.core.config import configuracion
from app.core.exceptions import registrar_manejadores

app = FastAPI(
    title=configuracion.app_name,
    version=configuracion.app_version,
    description="API REST para el control de inventario de dotaciones en Toronto",
)

registrar_manejadores(app)
app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["Estado"])
def inicio():
    return {
        "mensaje": "Bienvenido a dotaciones toronto",
        "version": configuracion.app_version,
        "estado": "API Funcionando",
    }
