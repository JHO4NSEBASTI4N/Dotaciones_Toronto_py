from pydantic_settings import BaseSettings, SettingsConfigDict


class Configuracion(BaseSettings):
    app_name: str = "dotacionestoronto"
    app_version: str = "1.0.0"
    
    database_url: str
    
    secret_key: str
    algorithm: str = "HS256"
    
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
    
configuracion = Configuracion()