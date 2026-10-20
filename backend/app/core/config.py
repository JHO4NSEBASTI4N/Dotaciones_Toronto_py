from pydantic_settings import BaseSettings, SettingsConfigDict


class Configuracion(BaseSettings):
    app_name: str = "dotacionestoronto"
    app_version: str = "1.0.0"
    
    database_url: str
    
    secret_key: str
    algorithm: str = "HS256"
    
    model_config = SettingsConfigDict(
        env_file = ".env",
        env_file_encoding = "utf-8",
        case_sensitive = False
    )
    
configuracion = Configuracion()