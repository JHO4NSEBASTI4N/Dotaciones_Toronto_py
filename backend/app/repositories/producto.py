from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.producto import Producto
from app.schemas.producto import ProductoActualizar, ProductoCrear


class ProductoRepositorio:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def buscar_por_id(self, id_producto: int) -> Producto | None:
        return self.sesion.get(Producto, id_producto)

    def buscar_por_nombre(self, nombre: str) -> Producto | None:
        return self.sesion.scalar(select(Producto).where(Producto.nombre == nombre))

    def _consulta_filtrada(
        self,
        nombre: str | None,
        categoria: str | None,
        talla: str | None,
        color: str | None,
        incluir_inhabilitados: bool,
    ):
        consulta = select(Producto)
        if nombre:
            consulta = consulta.where(Producto.nombre.ilike(f"%{nombre}%"))
        if categoria:
            consulta = consulta.where(Producto.categoria == categoria)
        if talla:
            consulta = consulta.where(Producto.talla == talla)
        if color:
            consulta = consulta.where(Producto.color == color)
        if not incluir_inhabilitados:
            consulta = consulta.where(
                (Producto.inhabilitado.is_(None)) | (Producto.inhabilitado == False)  # noqa: E712
            )
        return consulta

    def listar(
        self,
        saltar: int = 0,
        limite: int = 20,
        nombre: str | None = None,
        categoria: str | None = None,
        talla: str | None = None,
        color: str | None = None,
        incluir_inhabilitados: bool = False,
    ) -> list[Producto]:
        consulta = self._consulta_filtrada(
            nombre, categoria, talla, color, incluir_inhabilitados
        )
        consulta = (
            consulta.order_by(Producto.id_producto).offset(saltar).limit(limite)
        )
        return list(self.sesion.scalars(consulta))

    def contar(
        self,
        nombre: str | None = None,
        categoria: str | None = None,
        talla: str | None = None,
        color: str | None = None,
        incluir_inhabilitados: bool = False,
    ) -> int:
        consulta = self._consulta_filtrada(
            nombre, categoria, talla, color, incluir_inhabilitados
        )
        return self.sesion.scalar(
            select(func.count()).select_from(consulta.subquery())
        ) or 0

    def crear(self, datos: ProductoCrear) -> Producto:
        producto = Producto(**datos.model_dump(), estado="Disponible")
        self.sesion.add(producto)
        self.sesion.flush()
        return producto

    def actualizar(self, producto: Producto, datos: ProductoActualizar) -> Producto:
        for campo, valor in datos.model_dump(exclude_unset=True).items():
            setattr(producto, campo, valor)
        self.sesion.flush()
        return producto

    def inhabilitar(self, producto: Producto) -> Producto:
        """Borrado logico: la tabla producto esta referenciada por ventas e inventario."""
        producto.inhabilitado = True
        producto.estado = "Inhabilitado"
        self.sesion.flush()
        return producto

    def habilitar(self, producto: Producto) -> Producto:
        producto.inhabilitado = False
        producto.estado = "Disponible"
        self.sesion.flush()
        return producto