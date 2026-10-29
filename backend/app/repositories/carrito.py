from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.carrito import Carrito
from app.models.detalle_carrito import DetalleCarrito
from app.models.inventario import Inventario


class CarritoRepositorio:
    def _init_(self, sesion: Session) -> None:
        self.sesion = sesion

    # --- carrito -------------------------------------------------------------

    def buscar_por_id(self, id_carrito: int) -> Carrito | None:
        return self.sesion.get(Carrito, id_carrito)

    def buscar_activo_de_usuario(self, id_usuario: int) -> Carrito | None:
        """El carrito abierto del usuario (a lo sumo uno)."""
        return self.sesion.scalar(
            select(Carrito)
            .where(
                Carrito.id_usuario_fk == id_usuario,
                Carrito.inhabilitado == False,  # noqa: E712
            )
            .order_by(Carrito.id_carrito.desc())
        )

    def crear(self, id_usuario: int, fecha_creacion) -> Carrito:
        carrito = Carrito(
            id_usuario_fk=id_usuario, fecha_creacion=fecha_creacion, inhabilitado=False
        )
        self.sesion.add(carrito)
        self.sesion.flush()
        return carrito

    def inhabilitar(self, carrito: Carrito) -> Carrito:
        """Cierra el carrito sin borrarlo (regla del proyecto)."""
        carrito.inhabilitado = True
        self.sesion.flush()
        return carrito

    # --- detalles ------------------------------------------------------------

    def listar_detalles(
        self, id_carrito: int, incluir_inhabilitados: bool = False
    ) -> list[DetalleCarrito]:
        consulta = select(DetalleCarrito).where(
            DetalleCarrito.id_carrito_fk == id_carrito
        )
        if not incluir_inhabilitados:
            consulta = consulta.where(
                DetalleCarrito.inhabilitado == False  # noqa: E712
            )
        consulta = consulta.order_by(DetalleCarrito.id_detalle_carrito)
        return list(self.sesion.scalars(consulta))

    def buscar_detalle(self, id_detalle: int) -> DetalleCarrito | None:
        return self.sesion.get(DetalleCarrito, id_detalle)

    def buscar_detalle_de_producto(
        self, id_carrito: int, id_producto: int
    ) -> DetalleCarrito | None:
        """Busca la linea de ese producto, esté activa o no.

        Si está inhabilitada se reactiva, en vez de crear una fila duplicada.
        """
        return self.sesion.scalar(
            select(DetalleCarrito)
            .where(
                DetalleCarrito.id_carrito_fk == id_carrito,
                DetalleCarrito.id_producto_fk == id_producto,
            )
            .order_by(DetalleCarrito.id_detalle_carrito.desc())
        )

    def crear_detalle(
        self, id_carrito: int, id_producto: int, cantidad: int
    ) -> DetalleCarrito:
        detalle = DetalleCarrito(
            id_carrito_fk=id_carrito,
            id_producto_fk=id_producto,
            cantidad=cantidad,
            inhabilitado=False,
        )
        self.sesion.add(detalle)
        self.sesion.flush()
        return detalle

    def actualizar_detalle(
        self, detalle: DetalleCarrito, cantidad: int
    ) -> DetalleCarrito:
        detalle.cantidad = cantidad
        detalle.inhabilitado = False
        self.sesion.flush()
        return detalle

    def inhabilitar_detalle(self, detalle: DetalleCarrito) -> DetalleCarrito:
        detalle.inhabilitado = True
        self.sesion.flush()
        return detalle

    def inhabilitar_todos(self, id_carrito: int) -> int:
        """Vacia el carrito marcando las lineas, sin borrar ninguna."""
        cuantas = 0
        for detalle in self.listar_detalles(id_carrito):
            detalle.inhabilitado = True
            cuantas += 1
        self.sesion.flush()
        return cuantas

    # --- stock ---------------------------------------------------------------

    def stock_disponible(self, id_producto: int) -> int | None:
        """Suma del inventario del producto.

        Devuelve None si el producto no tiene ninguna fila de inventario
        (no hay contra que validar).
        """
        filas = self.sesion.scalar(
            select(func.count(Inventario.id_inventario)).where(
                Inventario.id_producto_fk == id_producto
            )
        )
        if not filas:
            return None
        return self.sesion.scalar(
            select(func.coalesce(func.sum(Inventario.cantidad_actual), 0)).where(
                Inventario.id_producto_fk == id_producto
            )
        ) or 0