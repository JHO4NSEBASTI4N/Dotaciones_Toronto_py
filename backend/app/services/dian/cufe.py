"""Calculo del CUFE (Codigo Unico de Factura Electronica).

El CUFE es la "huella" del documento: un SHA-384 de una cadena que arma el
software de facturacion con los datos de la factura. Si un solo dato cambia
(un peso, un digito del NIT), el CUFE cambia por completo. Por eso la DIAN lo
usa para verificar que el documento no fue alterado.

ORDEN EXACTO DE LA CADENA (Resolucion DIAN 000165 de 2023):

    NumFac + FecFac + HorFac + ValFac +
    CodImp1 + ValImp1 + CodImp2 + ValImp2 + CodImp3 + ValImp3 +
    ValTot + NitOFE + NumAdq + ClTec + TipoAmbiente

  NumFac        numero de la factura, con prefijo        DT0001
  FecFac        fecha de emision                        AAAA-MM-DD
  HorFac        hora de emision con zona horaria        HH:MM:SS-05:00
  ValFac        valor antes de impuestos                92436.97
  CodImp1/2/3   codigos de impuesto                     01 IVA, 04 INC, 03 ICA
  ValImp1/2/3   valor de cada impuesto
  ValTot        total de la factura (con impuestos)     110000.00
  NitOFE        NIT del que factura (sin digito de verificacion)
  NumAdq        documento del cliente
  ClTec         clave tecnica que asigna la DIAN a la resolucion
  TipoAmbiente  1 = produccion, 2 = pruebas

Los valores van con 2 decimales y punto (no coma), y NO llevan separadores de
miles. Un espacio de mas o un decimal de menos cambia el resultado y la DIAN
rechaza el documento.
"""

import hashlib
from datetime import datetime
from decimal import Decimal

# La DIAN exige estos codigos de impuesto en ese orden.
CODIGO_IVA = "01"
CODIGO_INC = "04"  # impuesto nacional al consumo (no aplica aqui -> 0.00)
CODIGO_ICA = "03"  # impuesto de industria y comercio (no aplica -> 0.00)

# Bogota es UTC-5 todo el año (no tiene horario de verano).
ZONA_HORARIA_COLOMBIA = "-05:00"


def formatear_valor(valor: Decimal | float | int | None) -> str:
    """Deja el valor con 2 decimales y punto, sin separador de miles.

    >>> formatear_valor(Decimal("92436.9"))
    '92436.90'
    """
    if valor is None:
        valor = Decimal("0")
    return f"{Decimal(str(valor)).quantize(Decimal('0.01'))}"


def construir_cadena_cufe(
    numero_factura: str,
    fecha_emision: datetime,
    valor_base: Decimal,
    total_iva: Decimal,
    total_factura: Decimal,
    nit_emisor: str,
    documento_adquirente: str,
    clave_tecnica: str,
    ambiente: str = "2",
) -> str:
    """Arma la cadena que se le aplica el hash. Se guarda para poder auditar."""
    return "".join(
        [
            numero_factura or "",
            fecha_emision.strftime("%Y-%m-%d"),
            fecha_emision.strftime("%H:%M:%S") + ZONA_HORARIA_COLOMBIA,
            formatear_valor(valor_base),
            CODIGO_IVA,
            formatear_valor(total_iva),
            CODIGO_INC,
            formatear_valor(0),
            CODIGO_ICA,
            formatear_valor(0),
            formatear_valor(total_factura),
            nit_emisor or "",
            documento_adquirente or "",
            clave_tecnica or "",
            ambiente or "2",
        ]
    )


def calcular_cufe(cadena: str) -> str:
    """Aplica SHA-384 y devuelve el CUFE en hexadecimal (96 caracteres)."""
    return hashlib.sha384(cadena.encode("utf-8")).hexdigest()
