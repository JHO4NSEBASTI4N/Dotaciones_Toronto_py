from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


class Configuracion(BaseSettings):
    app_name: str = "dotacionestoronto"
    app_version: str = "1.0.0"
    
    database_url: str
    
    secret_key: str
    algorithm: str = "HS256"

    # --- administrador inicial -----------------------------------------
    # Al arrancar, la aplicacion crea este usuario si no existe.
    # Se puede poner en False en el .env para desactivarlo (por ejemplo en
    # produccion, cuando el admin ya esta creado y se quiere controlar a mano).
    crear_admin_al_iniciar: bool = True
    admin_nombre: str = "Administrador"
    admin_correo: str = "admin@dotacionestoronto.com"
    admin_password: str = "Admin123"
    admin_documento: str = "0000000000"
    admin_telefono: str = "0000000000"
    admin_direccion: str = "Oficina principal"

    # --- facturacion electronica (DIAN) --------------------------------
    # Todos con valor por defecto para que el proyecto corra sin tocar el
    # .env. En produccion se cambian desde el .env, no en el codigo.
    dian_proveedor: str = "simulado"      # simulado | real
    dian_ambiente: str = "2"              # 1 produccion, 2 pruebas/habilitacion
    dian_iva_porcentaje: str = "19"

    # Datos del emisor (Dotaciones Toronto). Son los que salen impresos en la
    # factura, asi que deben coincidir con el RUT.
    dian_nit_emisor: str = "900123456"
    dian_dv_emisor: str = "8"
    dian_razon_social: str = "DOTACIONES TORONTO S.A.S."
    dian_nombre_comercial: str = "Dotaciones Toronto"
    dian_direccion: str = "CL 1 # 1 - 1"
    dian_ciudad: str = "Bogota D.C."
    dian_departamento: str = "Bogota D.C."
    dian_telefono: str = "3000000000"
    dian_correo: str = "facturacion@dotacionestoronto.com"
    dian_regimen: str = "48"              # 48 = responsable de IVA
    dian_responsabilidades: str = "O-13,O-15,O-23"
    dian_actividad_economica: str = "4641"
    dian_software_id: str = "00000000-0000-0000-0000-000000000000"
    dian_software_security_code: str = ""

    model_config = SettingsConfigDict(
        env_file = ".env",
        env_file_encoding = "utf-8",
        case_sensitive = False
    )


def _cargar_configuracion() -> "Configuracion":
    """Carga la configuracion y, si falta el .env, lo explica en cristiano.

    El archivo `.env` NO esta en el repositorio a proposito (lleva la
    SECRET_KEY y la clave de la base de datos). La consecuencia es que un clon
    nuevo no arranca hasta que cada uno cree el suyo. Antes eso salia como un
    `ValidationError` de pydantic que no decia que hacer; ahora sale una
    instruccion clara.
    """
    try:
        return Configuracion()
    except ValidationError as error:
        faltan = [
            str(fallo["loc"][0]).upper()
            for fallo in error.errors()
            if fallo["type"] == "missing"
        ]
        if not faltan:
            raise

        mensaje = [
            "",
            "=" * 70,
            "FALTA CONFIGURAR EL ARCHIVO .env",
            "=" * 70,
            "",
            f"  No encuentro: {', '.join(faltan)}",
            "",
            "  El archivo `.env` no se sube al repositorio, asi que hay que",
            "  crearlo una vez en tu maquina. Son dos pasos:",
            "",
            "    1) Entra a la carpeta backend/",
            "",
            "           cd backend",
            "",
            "    2) Copia la plantilla y pon tus valores:",
            "",
            "           Windows:  copy .env.example .env",
            "           Linux:    cp .env.example .env",
            "",
            "  Despues abre `backend/.env` y cambia SECRET_KEY por una clave",
            "  propia. Para generarla:",
            "",
            '      python -c "import secrets; print(secrets.token_hex(32))"',
            "",
            "  Si ya tienes un .env, revisa que este DENTRO de backend/ y no",
            "  en la raiz del repositorio.",
            "",
            "=" * 70,
            "",
        ]
        raise SystemExit("\n".join(mensaje)) from error


configuracion = _cargar_configuracion()