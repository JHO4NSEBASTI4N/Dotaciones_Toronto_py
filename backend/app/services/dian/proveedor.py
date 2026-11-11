"""Interfaz del proveedor de facturacion electronica.

ESTA ES LA PIEZA QUE SE CAMBIA EL DIA QUE HAYA CERTIFICADO DIGITAL.

Hoy el sistema trabaja con `ProveedorSimulado`, que arma el XML, calcula el
CUFE y responde "aceptado" sin salir a internet. Cuando la empresa tenga
resolucion aprobada, certificado digital y software registrado, se escribe
`ProveedorDIANReal` con esta misma interfaz y se cambia solo la linea de
`obtener_proveedor()`. Ni el servicio, ni los endpoints, ni los tests tocan
nada mas.

Contrato:
    enviar(documento) -> RespuestaDIAN

`documento` es un `dict` con lo que el proveedor necesita (numero, CUFE, XML,
datos del emisor y del adquiriente, totales). Se usa un dict a proposito: si
manana el proveedor real pide otro dato, se agrega al dict y ya, sin cambiar
la firma.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class RespuestaDIAN:
    """Lo que devuelve el proveedor despues de intentar enviar el documento.

    - `aceptada`    True si la DIAN lo acepto.
    - `estado`      texto para guardar en la columna `estado_dian`.
    - `mensaje`     explicacion para el usuario (se guarda en `mensaje_dian`).
    - `track_id`    identificador del tramite (lo da la DIAN). None si es simulado.
    - `payload`     JSON crudo de la respuesta, para la bitacora.
    """

    aceptada: bool
    estado: str
    mensaje: str
    track_id: Optional[str] = None
    payload: Optional[str] = None


class ProveedorDIAN:
    """Base de todos los proveedores. No se puede instanciar directamente."""

    nombre = "base"
    simulado = True

    def enviar(self, documento: dict) -> RespuestaDIAN:  # pragma: no cover
        raise NotImplementedError("Cada proveedor implementa su envio")

    def consultar_estado(self, track_id: str) -> RespuestaDIAN:  # pragma: no cover
        """Consulta como va un envio que quedo pendiente.

        El simulado responde que ya esta aceptado. El real preguntaria a la
        DIAN por el `track_id`.
        """
        raise NotImplementedError("Cada proveedor implementa la consulta")
