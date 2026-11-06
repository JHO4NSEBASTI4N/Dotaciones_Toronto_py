from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.core.config import configuracion
from app.core.exceptions import registrar_manejadores

app = FastAPI(
    title=configuracion.app_name,
    version=configuracion.app_version,
    description="API REST para el control de inventario de dotaciones en Toronto",
)

# --- CORS -------------------------------------------------------------------
# El frontend (React) corre en otro puerto (5173) que el backend (8000).
# Sin esto, el navegador bloquea las peticiones por "politica de mismo origen"
# y en la consola aparece el error:
#   "has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header"
# Aqui se le dice al backend en que direcciones puede confiar.
ORIGENES_PERMITIDOS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",  # vista previa de Vite (npm run preview)
    "http://127.0.0.1:4173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENES_PERMITIDOS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
