from sqlalchemy import text
from app.database.connection import motor

def probar():
    with motor.connect() as conn:
        r = conn.execute(text("SELECT 1")).scalar()
        print("OK. SELECT 1 =>", r)

if __name__ == "__main__":
    probar()