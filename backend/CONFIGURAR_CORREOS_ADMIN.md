# Bandeja de Gmail para el administrador

La sección «Correos de contacto» muestra **todos los correos de Recibidos / INBOX** de la cuenta configurada, incluidos los mensajes del formulario, respuestas de clientes y cualquier correo privado que haya llegado a esa bandeja. Solo los administradores pueden consultarla. No se modifica el formulario de contacto ni se crean tablas.

## Instalación

1. Antes de aplicar los archivos revisa los últimos cambios de GitHub y respalda cualquier cambio local. Copia los **archivos individuales** del ZIP a sus rutas correspondientes en la raíz del proyecto. En Windows, combina carpetas: **no reemplaces ni elimines carpetas completas**, porque perderías archivos que no se incluyen en el ZIP. Si un archivo existente tiene cambios propios, compáralos antes de reemplazarlo.
2. Conserva `backend/.env`; no viene en el ZIP y no debes borrarlo. Las variables son las mismas que usa el formulario de contacto:

   ```env
   CONTACTO_SMTP_USUARIO=dotacionestoronto1@gmail.com
   CONTACTO_SMTP_PASSWORD=tu_contraseña_de_aplicación
   ```

   Si el correo ya funciona, no es necesario crear otra contraseña. Es la contraseña de aplicación de Google, no la contraseña normal. No la compartas ni la subas a GitHub. Si no existe, activa la verificación en dos pasos y créala en https://myaccount.google.com/apppasswords.
3. La cuenta debe permitir IMAP. Comprueba la configuración y las políticas de Google si no conecta. El servidor necesita salida TLS a `imap.gmail.com:993` y `smtp.gmail.com:465`. La contraseña de aplicación permite acceso sensible al correo: protege `.env`, restringe el acceso al servidor y usa solo un entorno confiable.
4. Reinicia backend y frontend. Inicia sesión con el rol **Administrador** y abre **Correos de contacto**. Prueba con una cuenta propia antes de usarlo con clientes.

## Uso

- Se leen correos de Recibidos, antiguos y nuevos, en páginas de 50. Usa «Cargar anteriores»; se actualiza aproximadamente cada minuto mientras no haya selección ni borrador, y puedes pulsar «Actualizar». La consulta no marca los mensajes como leídos. Solo se ve la bandeja INBOX, no carpetas de archivados, spam, papelera ni enviados. Los correos borrados o no disponibles en Gmail no pueden recuperarse desde esta sección.
- Se muestra texto de forma segura. Para correos HTML se extrae texto sin ejecutar contenido; las imágenes, adjuntos y parte del contenido de correos grandes no se muestran. Para ver el mensaje completo o archivos adjuntos, abre Gmail. Las direcciones y encabezados pueden ser falsificados; verifica remitente y destino antes de responder.
- Selecciona uno o varios mensajes (hasta 25 destinatarios diferentes); cada destinatario recibe su propio correo sin ver las otras direcciones. Si un cliente tiene varios mensajes, selecciona solo uno por envío. El envío múltiple usa un mismo asunto y contenido y no admite adjuntos. Para respuestas individuales se usan las cabeceras de respuesta cuando existe Message-ID. La agrupación en hilos depende de Gmail.
- El botón de selección masiva automática fue retirado porque ahora se muestran todos los correos, también los privados. Selecciona destinatarios explícitamente. No envíes publicidad sin la autorización aplicable; los límites de Gmail siguen vigentes.
- «Aceptado» significa aceptación SMTP, no entrega final. Si el resultado es «desconocido» o se pierde la conexión, consulta Gmail antes de repetir para evitar duplicados. No hay reintentos automáticos. El sistema no mantiene historial propio ni marca los correos respondidos.

## Verificación

```bash
cd backend
python -m pytest app/tests/test_correos_admin.py app/tests/test_contacto.py app/tests/test_recuperacion.py -q
```

Las pruebas usan IMAP y SMTP simulados. Para comprobar la integración real, envía un mensaje desde el formulario, responde como administrador, contesta desde el correo personal del cliente y verifica que aparezca al actualizar la bandeja; también comprueba un correo anterior. No compartas contraseñas ni códigos durante la prueba.
