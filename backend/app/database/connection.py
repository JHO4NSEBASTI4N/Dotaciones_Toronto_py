from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import configuracion

motor = create_engine(
    configuracion.database_url,
    pool_pre_ping=True,
    echo=True,
)

SessionLocal = sessionmaker(
    bind=motor,
    autocommit=False,
    autoflush=False,
)

def obtener_sesion():
    sesion = SessionLocal()
    try:
        yield sesion
    finally:
        sesion.close()