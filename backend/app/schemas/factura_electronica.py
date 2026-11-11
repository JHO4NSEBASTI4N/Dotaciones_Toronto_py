"""Contratos Pydantic de la factura electronica (DIAN) y sus resoluciones.

Los Decimal salen como numero (no como texto) para que el frontend no tenga
que convertirlos. Se usa un `field_serializer` porque por defecto Pydantic
serializa Decimal como string.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator


# --- resoluciones de facturacion ----------------------------------------------

class ResolucionBase(BaseModel):
    tipo_documento: str = Field(default="01", max_length=4)
    numero_resolucion: Optional[str] = Field(default=None, max_length=40)
    prefijo: Optional[str] = Field(default=None, max_length=10)
    rango_desde: Optional[int] = Field(default=None, ge=1)
    rango_hasta: Optional[int] = Field(default=None, ge=1)
    clave_tecnica: Optional[str] = Field(default=None, max_length=128)
    vigencia_desde: Optional[date] = None
    vigencia_hasta: Optional[date] = None
    notificacion: Optional[str] = Field(default=None, max_length=100)


class ResolucionCrear(ResolucionBase):
    """Datos para dar de alta una resolucion de la DIAN."""

    @field_validator("rango_hasta")
    @classmethod
    def rango_coherente(cls, valor: Optional[int], info) -> Optional[int]:
        desde = info.data.get("rango_desde")
        if valor is not None and desde is not None and valor < desde:
            raise ValueError("rango_hasta no puede ser menor que rango_desde")
        return valor

    @field_validator("vigencia_hasta")
    @classmethod
    def vigencia_coherente(cls, valor: Optional[date], info) -> Optional[date]:
        desde = info.data.get("vigencia_desde")
        if valor is not None and desde is not None and valor < desde:
            raise ValueError("vigencia_hasta no puede ser anterior a vigencia_desde")
        return valor


class ResolucionActualizar(BaseModel):
    numero_resolucion: Optional[str] = Field(default=None, max_length=40)
    prefijo: Optional[str] = Field(default=None, max_length=10)
    rango_desde: Optional[int] = Field(default=None, ge=1)
    rango_hasta: Optional[int] = Field(default=None, ge=1)
    clave_tecnica: Optional[str] = Field(default=None, max_length=128)
    vigencia_desde: Optional[date] = None
    vigencia_hasta: Optional[date] = None
    notificacion: Optional[str] = Field(default=None, max_length=100)


class ResolucionRespuesta(ResolucionBase):
    model_config = ConfigDict(from_attributes=True)

    id_resolucion: int
    consecutivo_actual: Optional[int] = None
    vigente: bool = True

    @field_validator("vigente", mode="before")
    @classmethod
    def vigente_bool(cls, valor: object) -> bool:
        # La columna es tinyint(1)
        return True if valor is None else bool(valor)


# --- lineas -------------------------------------------------------------------

class LineaFacturaRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_detalle_factura: int
    numero_linea: Optional[int] = None
    codigo_producto: Optional[str] = None
    descripcion: Optional[str] = None
    cantidad: Optional[Decimal] = None
    unidad_medida: Optional[str] = None
    precio_unitario: Optional[Decimal] = None
    descuento: Optional[Decimal] = None
    iva_porcentaje: Optional[Decimal] = None
    iva_valor: Optional[Decimal] = None
    total_linea: Optional[Decimal] = None

    @field_serializer(
        "cantidad",
        "precio_unitario",
        "descuento",
        "iva_porcentaje",
        "iva_valor",
        "total_linea",
    )
    def decimal_a_numero(self, valor: Optional[Decimal]) -> Optional[float]:
        return None if valor is None else float(valor)


# --- eventos ------------------------------------------------------------------

class EventoFacturaRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_evento: int
    fecha: Optional[datetime] = None
    tipo: Optional[str] = None
    estado: Optional[str] = None
    mensaje: Optional[str] = None


# --- factura electronica ------------------------------------------------------

class FacturaElectronicaRespuesta(BaseModel):
    """Vista resumida (sin el XML, que puede pesar mucho)."""

    model_config = ConfigDict(from_attributes=True)

    id_factura: int
    id_venta_fk: Optional[int] = None
    id_pedido_fk: Optional[int] = None
    id_cliente_fk: Optional[int] = None
    tipo_documento: Optional[str] = None
    numero_factura: str
    prefijo: Optional[str] = None
    consecutivo: Optional[int] = None
    fecha_emision: Optional[datetime] = None
    estado: Optional[str] = None
    cufe: Optional[str] = None
    valor_bruto: Optional[Decimal] = None
    descuento_total: Optional[Decimal] = None
    total_iva: Optional[Decimal] = None
    total_impuestos: Optional[Decimal] = None
    total_factura: Optional[Decimal] = None
    moneda: Optional[str] = None
    nit_emisor: Optional[str] = None
    razon_social_emisor: Optional[str] = None
    nit_adquirente: Optional[str] = None
    razon_social_adquirente: Optional[str] = None
    estado_dian: Optional[str] = None
    mensaje_dian: Optional[str] = None
    track_id: Optional[str] = None
    fecha_envio: Optional[datetime] = None
    fecha_respuesta: Optional[datetime] = None
    intentos: Optional[int] = None
    firmado: bool = False
    simulado: bool = False
    creado_en: Optional[datetime] = None

    @field_validator("firmado", "simulado", mode="before")
    @classmethod
    def bool_desde_tinyint(cls, valor: object) -> bool:
        return False if valor is None else bool(valor)

    @field_serializer(
        "valor_bruto",
        "descuento_total",
        "total_iva",
        "total_impuestos",
        "total_factura",
    )
    def decimal_a_numero(self, valor: Optional[Decimal]) -> Optional[float]:
        return None if valor is None else float(valor)


class FacturaElectronicaDetalleRespuesta(FacturaElectronicaRespuesta):
    """Vista completa: incluye las lineas y los eventos."""

    lineas: list[LineaFacturaRespuesta] = []
    eventos: list[EventoFacturaRespuesta] = []


class GenerarFacturaEntrada(BaseModel):
    """Datos para generar la factura electronica de una venta.

    Todos son opcionales: por defecto se toman los del cliente y los de la
    configuracion del emisor. Se dejan abiertos porque a veces se factura a
    nombre de otra persona o empresa (el cliente pide la factura a nombre de
    su empleador, por ejemplo).
    """

    id_venta: int = Field(gt=0)
    tipo_doc_adquirente: Optional[str] = Field(default=None, max_length=4)
    nit_adquirente: Optional[str] = Field(default=None, max_length=30)
    dv_adquirente: Optional[str] = Field(default=None, max_length=2)
    razon_social_adquirente: Optional[str] = Field(default=None, max_length=200)
    correo_adquirente: Optional[str] = Field(default=None, max_length=150)
    direccion_adquirente: Optional[str] = Field(default=None, max_length=200)
    telefono_adquirente: Optional[str] = Field(default=None, max_length=40)
    ciudad_adquirente: Optional[str] = Field(default=None, max_length=100)
    forma_pago: str = Field(default="1", max_length=4)
    medio_pago: str = Field(default="10", max_length=4)


class EnviarFacturaEntrada(BaseModel):
    """Opciones del envio. Hoy no hay ninguna obligatoria."""

    forzar_reenvio: bool = Field(
        default=False,
        description="Reenviar aunque ya haya sido aceptada (queda en la bitacora)",
    )
