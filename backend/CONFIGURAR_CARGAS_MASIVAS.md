# Cargas masivas desde Excel

## Instalación

1. Copia los archivos del ZIP en la raíz del repositorio, respetando las carpetas. No sustituyas ni compartas `backend/.env`.
2. Si faltan dependencias, activa el entorno virtual y ejecuta desde la raíz: `pip install -r requirements.txt`. El proyecto ya declara `openpyxl` y `python-multipart`. No requiere migración de base de datos.
3. Reinicia backend y frontend. Entra como **Administrador** y abre Productos, Inventario o Usuarios.

## Cómo usar

En cada módulo abre **Carga masiva desde Excel**, descarga la plantilla, rellena únicamente la hoja `Datos`, guarda el `.xlsx`, selecciona el archivo y pulsa **Validar archivo**. El sistema muestra errores por fila. Si hay errores no se guarda ninguna fila. Corrige el archivo, selecciónalo otra vez y vuelve a validar. Cuando esté correcto pulsa **Confirmar y guardar**. Se vuelve a validar en el servidor antes de guardar todo en una transacción.

Máximo: 500 filas y 2 MB por archivo; no se permiten fórmulas. No modifiques ni borres los encabezados. Guarda el documento y teléfono como **texto** en Excel si contienen ceros iniciales. Prueba primero con pocos datos y haz una copia de seguridad de la base de datos.

### Productos

`nombre` y `precio` son obligatorios. `categoria`, `talla`, `color` e `imagen` son opcionales (si no hay categoría se usa General). `imagen` es una ruta o URL, no un archivo incrustado. Cada fila crea un producto nuevo; si ya existe un nombre, no se guarda la carga. Los productos nuevos no traen unidades: agrega el inventario por separado.

### Inventario

`id_producto` debe corresponder a un producto existente y habilitado. `cantidad` debe ser entera positiva: **se suma**, no reemplaza el stock. `stock_minimo` es opcional y solo se usa cuando se crea el primer inventario de ese producto; para uno ya existente déjalo vacío. Cada producto aparece una sola vez en el archivo. Se registra un movimiento de ENTRADA con el responsable. Si hay varias filas de inventario antiguas para el producto, la entrada se suma a la primera habilitada.

**No vuelvas a confirmar el mismo archivo**: las cantidades se sumarían nuevamente. Si se pierde la conexión durante la confirmación, revisa existencias e historial de movimientos antes de reintentar: la respuesta puede perderse aunque el servidor haya guardado los datos.

### Usuarios

`nombre`, `correo` e `id_rol` activo son obligatorios. `documento`, `telefono` y `direccion` son opcionales. Revisa los IDs de roles en el módulo Roles; los IDs habituales son 1 Administrador, 2 Cliente, 3 Vendedor y 4 Bodeguero, pero confirma los existentes en tu base. El correo no puede estar repetido.

No incluyas contraseñas en el Excel. Cada cuenta se crea con una clave aleatoria desconocida que no se muestra ni se envía. **Cada persona necesita establecer su contraseña antes de ingresar**: el administrador puede asignarla individualmente con la acción de restablecer contraseña del módulo Usuarios y entregarla de forma segura; o la persona puede usar «¿Olvidaste tu contraseña?» en el login y recibir un código en su correo registrado. Esta segunda opción requiere que la recuperación esté configurada y que la persona tenga acceso a ese correo. Conserva la lista de personas cargadas para comprobar que completen el paso. El sistema no obliga actualmente a cambiar la contraseña en el primer inicio de sesión.

La carga masiva y sus plantillas están restringidas al rol activo de Administrador. Para una instalación en producción, usa HTTPS y protege el acceso y las copias de seguridad. No publiques archivos Excel con datos personales.
