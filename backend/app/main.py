from fastapi import FastAPI
from app.core.config import configuracion

app = FastAPI(
    title = configuracion.app_name,
    version = configuracion.app_version,
    description = "API REST para el control de inventario de dotaciones en Toronto",
)

@app.get("/")
def inicio():
    return {
        "mensaje": "Bienvenido a dotaciones toronto",
        "version": configuracion.app_version,
        "estado": "API Funcionando"
    }