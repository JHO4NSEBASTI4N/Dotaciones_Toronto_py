"""Paquete del proveedor de facturacion electronica.

    cufe.py        Calculo del CUFE (SHA-384 de la cadena oficial)
    xml_ubl.py     Generacion del XML UBL 2.1
    proveedor.py   Interfaz que deben cumplir todos los proveedores
    simulado.py    Proveedor simulado (el que se usa hoy)

PARA CONECTAR CON LA DIAN DE VERDAD
-----------------------------------
1. Crear `real.py` con una clase `ProveedorDIANReal(ProveedorDIAN)` que
   implemente `enviar()` y `consultar_estado()` usando el certificado digital.
2. Ajustar `obtener_proveedor()` de abajo para que devuelva esa clase cuando
   `configuracion.dian_proveedor == "real"`.
3. Cambiar `DIAN_PROVEEDOR=real` en el `.env`.

Nada mas: el servicio y los endpoints no se tocan.
"""

from app.core.config import configuracion
from app.services.dian.proveedor import ProveedorDIAN, RespuestaDIAN
from app.services.dian.simulado import ProveedorSimulado

__all__ = [
    "ProveedorDIAN",
    "ProveedorSimulado",
    "RespuestaDIAN",
    "obtener_proveedor",
]


def obtener_proveedor() -> ProveedorDIAN:
    """Devuelve el proveedor configurado.

    Hoy solo existe el simulado. Cuando exista el real, se agrega aqui:

        if configuracion.dian_proveedor == "real":
            from app.services.dian.real import ProveedorDIANReal
            return ProveedorDIANReal()

    Si alguien configura "real" antes de que exista, se avisa con un error
    claro en vez de fallar de forma rara a mitad del proceso.
    """
    if (configuracion.dian_proveedor or "").lower() == "real":
        raise NotImplementedError(
            "El proveedor real de la DIAN todavia no esta implementado. "
            "Use DIAN_PROVEEDOR=simulado en el .env"
        )
    return ProveedorSimulado()
