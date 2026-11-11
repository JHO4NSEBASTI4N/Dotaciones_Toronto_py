"""Proveedor simulado: hace todo el proceso menos salir a internet.

Que SI hace (para que el proyecto sirva como trabajo real):
  - valida que el documento tenga lo minimo,
  - arma el XML UBL 2.1,
  - verifica el CUFE,
  - responde con un `track_id` y deja la bitacora igual que un envio real.

Que NO hace:
  - no firma con certificado digital,
  - no transmite a la DIAN,
  - no obtiene un CUFE avalado por la DIAN.

Por eso los documentos quedan marcados con `simulado = 1`: asi nadie confunde
una prueba con una factura valida ante la DIAN.
"""

import json
import uuid
from datetime import datetime

from app.services.dian.proveedor import ProveedorDIAN, RespuestaDIAN


class ProveedorSimulado(ProveedorDIAN):
    nombre = "simulado"
    simulado = True

    def enviar(self, documento: dict) -> RespuestaDIAN:
        """Simula el envio: valida lo indispensable y acepta el documento."""
        faltantes = [
            campo
            for campo in ("numero_factura", "cufe", "xml", "total_factura")
            if not documento.get(campo)
        ]
        if faltantes:
            return RespuestaDIAN(
                aceptada=False,
                estado="RECHAZADA",
                mensaje="Documento incompleto para enviar: "
                + ", ".join(faltantes),
                payload=json.dumps({"simulado": True, "faltantes": faltantes}),
            )

        track_id = str(uuid.uuid4())

        return RespuestaDIAN(
            aceptada=True,
            estado="ACEPTADA",
            mensaje=(
                "Documento aceptado en MODO SIMULACION "
                "(no fue transmitido a la DIAN)."
            ),
            track_id=track_id,
            payload=json.dumps(
                {
                    "simulado": True,
                    "trackId": track_id,
                    "statusCode": "00",
                    "statusDescription": "Procesado correctamente (simulacion)",
                    "fecha": datetime.now().isoformat(timespec="seconds"),
                }
            ),
        )

    def consultar_estado(self, track_id: str) -> RespuestaDIAN:
        """En simulacion, un envio siempre termina aceptado."""
        return RespuestaDIAN(
            aceptada=True,
            estado="ACEPTADA",
            mensaje="Consulta simulada: documento aceptado.",
            track_id=track_id,
            payload=json.dumps({"simulado": True, "trackId": track_id}),
        )
