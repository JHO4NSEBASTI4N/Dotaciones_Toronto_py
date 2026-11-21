# Activar el formulario de contacto con Gmail

El formulario de la página principal envía mensajes a **dotacionestoronto1@gmail.com**. El servidor envía usando SMTP seguro (SSL, `smtp.gmail.com:465`) y configura como dirección de respuesta el correo escrito por el visitante. No necesitas cambiar la base de datos.

## Configuración (la hace el dueño de la cuenta)

1. Aplica los archivos del ZIP en la raíz del proyecto. **No reemplaces tu `backend/.env` existente por `.env.example`**, pues perderías la configuración de la base de datos y las claves actuales.
2. En la cuenta Google `dotacionestoronto1@gmail.com`, activa la verificación en dos pasos: https://myaccount.google.com/security
3. Abre https://myaccount.google.com/apppasswords y crea una **contraseña de aplicación** para el formulario. Si no aparece la opción, consulta https://support.google.com/accounts/answer/185833?hl=es (puede no estar disponible con algunas políticas de la cuenta).
4. En tu computadora o servidor, abre el archivo privado `backend/.env` que ya existe y añade al final estas líneas, sin borrar el resto:

   ```env
   CONTACTO_SMTP_USUARIO=dotacionestoronto1@gmail.com
   CONTACTO_SMTP_PASSWORD=PEGA_AQUI_LA_CONTRASENA_DE_APLICACION
   ```

   Pega la contraseña de aplicación creada por Google en el lugar indicado. No uses la contraseña normal de Gmail. No compartas esta clave por chat ni la subas a GitHub. El repositorio ya ignora `.env`.
5. Reinicia el backend desde la carpeta `backend`, como lo haces normalmente, para que lea el `.env`. Reinicia también el frontend. El servidor necesita salida de red hacia `smtp.gmail.com` en el puerto 465.
6. Abre la página principal, envía una prueba y revisa la bandeja de entrada y spam de `dotacionestoronto1@gmail.com`. Al pulsar **Responder** se usará el correo que puso el visitante.

El formulario muestra éxito solo cuando el servidor SMTP acepta el mensaje. Sin la configuración o si hay un fallo de conexión/autenticación, muestra un error y conserva el contenido para reintentar. La aceptación SMTP no garantiza la entrega final: comprueba también spam y posibles rechazos de Gmail.

## Si no funciona

- Verifica que hayas reiniciado el backend, que el `.env` esté en `backend/` y que no hayas cambiado el nombre de las variables.
- Asegúrate de haber creado una **contraseña de aplicación** de la cuenta correcta. Si cambias la contraseña de Google, puede ser necesario crear otra contraseña de aplicación.
- Revisa si el servidor permite conexiones salientes al puerto 465. Si el formulario muestra un error de red, verifica que el frontend pueda acceder al backend.
- Hay un límite básico de 5 intentos por IP cada 15 minutos y por proceso para reducir abuso. En un despliegue con proxy o varios procesos configura también límites y protección antispam en la infraestructura; el límite local no es una protección completa.
