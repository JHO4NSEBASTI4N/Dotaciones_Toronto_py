# Recuperación de contraseña por correo

La opción «¿Olvidaste tu contraseña?» del login permite solicitar un código al correo registrado, verificarlo y escoger una contraseña nueva. Utiliza la misma cuenta SMTP configurada para el formulario de contacto; **el código llega al correo registrado de cada usuario**, no al correo de la tienda (salvo que ese sea el correo del usuario).

## 1. Aplicar los archivos

Copia los archivos del ZIP en la raíz del repositorio, conservando sus rutas. Revisa tus propios cambios locales antes de reemplazar archivos. No sobrescribas `backend/.env`: contiene tu configuración privada. Esta entrega es independiente de las cargas masivas.

## 2. Crear únicamente la tabla nueva

Haz primero una copia de seguridad de la base de datos. Con MySQL encendido, abre phpMyAdmin, selecciona **la base de datos que usa el proyecto** (mira el nombre en `DATABASE_URL`, sin compartir su valor) y ejecuta o importa exclusivamente el archivo `backend/migraciones/recuperacion_password.sql` de este ZIP.

El script crea la tabla `recuperacion_password` si no existe; no borra usuarios ni datos existentes. **No importes de nuevo el volcado completo de la base de datos.** Sin esta tabla, los endpoints de recuperación fallarán.

## 3. Configurar y probar

1. Conserva en `backend/.env` las variables `CONTACTO_SMTP_USUARIO` y `CONTACTO_SMTP_PASSWORD` que ya usaste para el formulario de contacto. La contraseña debe ser la contraseña de aplicación de Google. No la compartas ni la subas a GitHub. No es necesario crear otra contraseña de aplicación si la anterior funciona.
2. Asegúrate de que `SECRET_KEY` sea una clave larga, aleatoria y privada; se utiliza para proteger los códigos y los tokens. Cambiar una clave existente invalida las sesiones actuales y las recuperaciones pendientes; coordina ese cambio y no sustituyas el archivo `.env`.
3. Reinicia el backend y el frontend. Abre el login y elige **¿Olvidaste tu contraseña?**.
4. Introduce el correo de una cuenta **habilitada** a cuya bandeja tengas acceso. Busca el código en entrada o spam; introdúcelo y escribe la nueva contraseña dos veces. Luego vuelve al login e inicia sesión con la nueva contraseña.

Por seguridad, la respuesta inicial es la misma para correos registrados y no registrados, y también si el envío falla. No garantiza que el correo haya llegado. Si no llega, espera al menos un minuto para solicitar otro; verifica spam, que el correo guardado sea correcto, que la cuenta esté habilitada, la configuración SMTP y la terminal del backend. Si una cuenta tiene un correo ficticio o ya no accesible, el administrador debe ayudar a restablecer el acceso por el procedimiento de gestión de usuarios.

## Seguridad y límites

- El código tiene seis dígitos, caduca a los 10 minutos y solo puede verificarse una vez. El permiso posterior de cambio también caduca y se consume una sola vez.
- Tras cinco códigos incorrectos se bloquea esa recuperación por 15 minutos. Hay una espera de 60 segundos entre solicitudes por cuenta; para no revelar si existe la cuenta, el mensaje siempre es genérico.
- El servidor almacena HMAC del código y del permiso, no el código ni el permiso en texto. Una nueva contraseña o un nuevo código invalida el proceso previo.
- El límite por IP es básico, está en memoria y se aplica por proceso; no cubre varios workers ni reinicios. En producción configura protección compartida/rate limiting en el proxy o WAF, especialmente si hay balanceador. El código no confía en cabeceras IP proporcionadas por el cliente.
- El proyecto existente no revoca automáticamente los tokens de sesión ya emitidos al cambiar una contraseña. Pueden seguir vigentes hasta que expiren; para producción se recomienda implementar revocación de sesiones.
- Usa HTTPS para el frontend y la API en producción y mantén privados los registros de aplicación y las copias de seguridad. No compartas códigos, contraseñas ni `.env`.
