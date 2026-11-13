from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.core.dependencies import (
    ROL_ADMINISTRADOR,
    ROL_BODEGUERO,
    SesionBD,
    UsuarioActual,
    requiere_rol,
)
from app.core.pagination import PaginaRespuesta, ParametrosPaginacion
from app.schemas.producto import ProductoActualizar, ProductoCrear, ProductoRespuesta
from app.services import producto as servicio

router = APIRouter()

# Las imágenes se guardan en archivos del servidor y en la BD solo queda la URL.
DIRECTORIO_IMAGENES = Path(__file__).resolve().parents[4] / "uploads" / "productos"
TAMANO_MAXIMO_IMAGEN = 5 * 1024 * 1024
TIPOS_IMAGEN = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

# Crear y editar: administrador o bodeguero
PuedeGestionar = Depends(requiere_rol(ROL_ADMINISTRADOR, ROL_BODEGUERO))


@router.post("/imagen", dependencies=[Depends(requiere_rol(ROL_ADMINISTRADOR))])
async def subir_imagen_producto(archivo: UploadFile = File(...)):
    """Guarda una imagen de producto y devuelve la ruta pública para la ficha."""
    extension = TIPOS_IMAGEN.get(archivo.content_type or "")
    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Usa una imagen JPG, PNG o WebP.",
        )

    contenido = await archivo.read(TAMANO_MAXIMO_IMAGEN + 1)
    if not contenido:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")
    if len(contenido) > TAMANO_MAXIMO_IMAGEN:
        raise HTTPException(status_code=413, detail="La imagen no puede superar 5 MB.")

    firma_valida = {
        "image/jpeg": contenido.startswith(b"\xff\xd8\xff"),
        "image/png": contenido.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/webp": (
            len(contenido) >= 12
            and contenido.startswith(b"RIFF")
            and contenido[8:12] == b"WEBP"
        ),
    }[archivo.content_type]
    if not firma_valida:
        raise HTTPException(status_code=415, detail="El contenido del archivo no es una imagen válida.")

    DIRECTORIO_IMAGENES.mkdir(parents=True, exist_ok=True)
    nombre_archivo = f"{uuid4().hex}{extension}"
    (DIRECTORIO_IMAGENES / nombre_archivo).write_bytes(contenido)
    return {"imagen": f"/uploads/productos/{nombre_archivo}"}


@router.get("", response_model=PaginaRespuesta[ProductoRespuesta])
def listar(
    sesion: SesionBD,
    paginacion: ParametrosPaginacion = Depends(),
    nombre: Optional[str] = Query(None, description="Busqueda parcial por nombre"),
    categoria: Optional[str] = Query(None),
    talla: Optional[str] = Query(None),
    color: Optional[str] = Query(None),
    incluir_inhabilitados: bool = Query(False),
):
    """Listado paginado y filtrable. Publico (no requiere token)."""
    items, total = servicio.listar_productos(
        sesion,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        nombre=nombre,
        categoria=categoria,
        talla=talla,
        color=color,
        incluir_inhabilitados=incluir_inhabilitados,
    )
    return PaginaRespuesta[ProductoRespuesta](
        total=total,
        saltar=paginacion.saltar,
        limite=paginacion.limite,
        items=[ProductoRespuesta.model_validate(p) for p in items],
    )


@router.get("/{id_producto}", response_model=ProductoRespuesta)
def detalle(id_producto: int, sesion: SesionBD):
    """Detalle de un producto. Publico."""
    return servicio.obtener_producto(sesion, id_producto)


@router.post(
    "",
    response_model=ProductoRespuesta,
    status_code=status.HTTP_201_CREATED,
    dependencies=[PuedeGestionar],
)
def crear(datos: ProductoCrear, sesion: SesionBD):
    """Crea un producto. Requiere rol Administrador o Bodeguero."""
    return servicio.crear_producto(sesion, datos)


@router.patch(
    "/{id_producto}",
    response_model=ProductoRespuesta,
    dependencies=[PuedeGestionar],
)
def actualizar(id_producto: int, datos: ProductoActualizar, sesion: SesionBD):
    """Actualizacion parcial. Requiere rol Administrador o Bodeguero."""
    return servicio.actualizar_producto(sesion, id_producto, datos)


@router.post(
    "/{id_producto}/inhabilitar",
    response_model=ProductoRespuesta,
    dependencies=[Depends(requiere_rol(ROL_ADMINISTRADOR))],
)
def inhabilitar(id_producto: int, sesion: SesionBD):
    """Inhabilita el producto (marca inhabilitado=True).

    REGLA DEL PROYECTO: no se elimina informacion. No existe DELETE en esta API.
    Un producto inhabilitado desaparece del catalogo publico pero conserva su
    historial de ventas, pedidos e inventario.
    """
    return servicio.inhabilitar_producto(sesion, id_producto)


@router.post(
    "/{id_producto}/habilitar",
    response_model=ProductoRespuesta,
    dependencies=[Depends(requiere_rol(ROL_ADMINISTRADOR))],
)
def habilitar(id_producto: int, sesion: SesionBD):
    """Revierte el borrado logico."""
    return servicio.habilitar_producto(sesion, id_producto)