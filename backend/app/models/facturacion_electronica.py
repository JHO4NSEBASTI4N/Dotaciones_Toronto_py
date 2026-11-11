"""Modelo de la factura electronica (documento DIAN).

Es el documento fiscal de verdad: el que lleva CUFE, XML UBL 2.1 y la
respuesta de la DIAN. NO reemplaza a `factura`, que es el comprobante interno
que genera la venta; la electronica cuelga de la venta.

ESTADOS DEL DOCUMENTO (`estado`):
    BORRADOR   -> creado, todavia sin firmar ni enviar
    FIRMADA    -> ya se le calculo el CUFE y se armo el XML
    ENVIADA    -> se mando a la DIAN (o al simulador) y se espera respuesta
    ACEPTADA   -> la DIAN lo acepto
    RECHAZADA  -> la DIAN lo rechazo (queda el motivo en mensaje_dian)
    ANULADA    -> baja logica (regla del proyecto: no se borra)

`simulado` queda en 1 cuando el documento no salio de verdad hacia la DIAN,
que es lo que pasa en este proyecto mientras no haya certificado digital.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

# En MySQL la columna `xml` es LONGTEXT (4 GB); en las pruebas con SQLite
# no existe ese tipo, asi que se usa TEXT como variante. Los modelos no cambian.
TEXTO_LARGO = Text().with_variant(LONGTEXT, "mysql")

from app.database.base import Base


class FacturaElectronica(Base):
    __tablename__ = "factura_electronica"

    id_factura: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    id_venta_fk: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("venta.id_venta"), nullable=True
    )
    id_pedido_fk: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("pedido.id_pedido"), nullable=True
    )
    id_cliente_fk: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("usuario.id_usuario"), nullable=True
    )

    # --- identificacion del documento ---------------------------------
    tipo_documento: Mapped[Optional[str]] = mapped_column(
        String(4), default="01", nullable=True
    )
    numero_factura: Mapped[str] = mapped_column(String(60), nullable=False)
    prefijo: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    consecutivo: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    fecha_emision: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    estado: Mapped[Optional[str]] = mapped_column(
        String(20), default="BORRADOR", nullable=True
    )
    cufe: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    cadena_cufe: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # --- valores ------------------------------------------------------
    valor_bruto: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(19, 2), server_default=text("0.00"), default=Decimal("0.00")
    )
    descuento_total: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(19, 2), server_default=text("0.00"), default=Decimal("0.00")
    )
    total_iva: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(19, 2), server_default=text("0.00"), default=Decimal("0.00")
    )
    total_impuestos: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(19, 2), server_default=text("0.00"), default=Decimal("0.00")
    )
    total_factura: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(19, 2), server_default=text("0.00"), default=Decimal("0.00")
    )
    moneda: Mapped[Optional[str]] = mapped_column(
        String(3), default="COP", nullable=True
    )
    forma_pago: Mapped[Optional[str]] = mapped_column(
        String(4), default="1", nullable=True
    )
    medio_pago: Mapped[Optional[str]] = mapped_column(
        String(4), default="10", nullable=True
    )

    # --- emisor (Dotaciones Toronto) ----------------------------------
    nit_emisor: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    dv_emisor: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)
    razon_social_emisor: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True
    )
    nombre_comercial_emisor: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True
    )
    direccion_emisor: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True
    )
    ciudad_emisor: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    departamento_emisor: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )
    telefono_emisor: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    correo_emisor: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    regimen_emisor: Mapped[Optional[str]] = mapped_column(String(6), nullable=True)
    responsabilidades_emisor: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )
    actividad_economica_emisor: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True
    )

    # --- adquiriente (el cliente) -------------------------------------
    tipo_doc_adquirente: Mapped[Optional[str]] = mapped_column(
        String(4), default="13", nullable=True
    )
    nit_adquirente: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    dv_adquirente: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)
    razon_social_adquirente: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True
    )
    correo_adquirente: Mapped[Optional[str]] = mapped_column(
        String(150), nullable=True
    )
    direccion_adquirente: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True
    )
    telefono_adquirente: Mapped[Optional[str]] = mapped_column(
        String(40), nullable=True
    )
    ciudad_adquirente: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )

    # --- datos de la DIAN --------------------------------------------
    clave_tecnica: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    resolucion_numero: Mapped[Optional[str]] = mapped_column(
        String(40), nullable=True
    )
    resolucion_desde: Mapped[Optional[int]] = mapped_column(
        BigInteger, nullable=True
    )
    resolucion_hasta: Mapped[Optional[int]] = mapped_column(
        BigInteger, nullable=True
    )
    resolucion_vigencia_desde: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True
    )
    resolucion_vigencia_hasta: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True
    )
    software_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    software_security_code: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True
    )
    # "1" = produccion, "2" = habilitacion (pruebas). El dump usa 2.
    ambiente: Mapped[Optional[str]] = mapped_column(
        String(2), default="2", nullable=True
    )

    # --- resultado del proceso ---------------------------------------
    qr_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    xml: Mapped[Optional[str]] = mapped_column(TEXTO_LARGO, nullable=True)
    firmado: Mapped[bool] = mapped_column(
        Boolean, server_default=text("0"), default=False, nullable=False
    )
    estado_dian: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    mensaje_dian: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    track_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    fecha_envio: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    fecha_respuesta: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )
    intentos: Mapped[Optional[int]] = mapped_column(
        Integer, server_default=text("0"), default=0
    )
    ultimo_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    simulado: Mapped[bool] = mapped_column(
        Boolean, server_default=text("0"), default=False, nullable=False
    )
    creado_en: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    actualizado_en: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )

    # --- relaciones ---------------------------------------------------
    lineas: Mapped[list["FacturaElectronicaDetalle"]] = relationship(
        "FacturaElectronicaDetalle",
        back_populates="factura",
        cascade="all, delete-orphan",
    )
    eventos: Mapped[list["FacturaElectronicaEvento"]] = relationship(
        "FacturaElectronicaEvento",
        back_populates="factura",
        cascade="all, delete-orphan",
    )
