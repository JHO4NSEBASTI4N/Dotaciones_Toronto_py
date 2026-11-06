from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
APP = RAIZ / "app"

# roto -> correcto
DUNDERS = {
    "init": "_init_",
    "tablename": "_tablename_",
    "all": "_all_",
    "repr": "_repr_",
    "str": "_str_",
}

problemas: list[str] = []
avisos: list[str] = []


# Nombres que Markdown dejo a medio comer, con el nombre que deberia tener.
NOMBRES_ROTOS = {
    "init.py": "_init_.py",
    "main.py": "_main_.py",
    "tablename.py": None,
}


def revisar_nombres() -> None:
    """Archivos cuyo NOMBRE quedo mal (Markdown se comio los guiones bajos).

    Un archivo llamado _init_.py no sirve para nada: Python no lo reconoce
    como inicializador del paquete. Ahi esta el error, no en que este vacio.
    """
    for archivo in sorted(APP.rglob("*.py")):
        if "_pycache_" in archivo.parts:
            continue
        correcto = NOMBRES_ROTOS.get(archivo.name)
        if correcto:
            problemas.append(
                f"NOMBRE      {archivo.relative_to(RAIZ)}  "
                f"deberia llamarse '{correcto}' (no '{archivo.name}')"
            )


def revisar_vacios() -> None:
    for archivo in sorted(APP.rglob("*.py")):
        if "_pycache_" in archivo.parts:
            continue
        if archivo.name in NOMBRES_ROTOS:
            continue  # ya se reporta como NOMBRE, no como VACIO
        # Un _init_.py vacio es lo normal: solo marca que la carpeta es un
        # paquete de Python. No es un error.
        if archivo.stat().st_size == 0 and archivo.name != "_init_.py":
            problemas.append(f"VACIO       {archivo.relative_to(RAIZ)}")


def revisar_dunders() -> None:
    for archivo in sorted(APP.rglob("*.py")):
        if "_pycache_" in archivo.parts:
            continue
        texto = archivo.read_text(encoding="utf-8", errors="ignore")
        for i, linea in enumerate(texto.splitlines(), 1):
            for roto, correcto in DUNDERS.items():
                # exactamente un guion bajo a cada lado
                if re.search(rf"(?<!){re.escape(roto)}(?!)", linea):
                    problemas.append(
                        f"DUNDER      {archivo.relative_to(RAIZ)}:{i}  "
                        f"'{roto}' deberia ser '{correcto}'"
                        "  (Markdown se comio los guiones bajos)"
                    )
                    break


def revisar_truncados() -> None:
    for archivo in sorted(APP.rglob("*.py")):
        if "_pycache_" in archivo.parts:
            continue
        try:
            ast.parse(archivo.read_text(encoding="utf-8"))
        except SyntaxError as e:
            problemas.append(
                f"TRUNCADO    {archivo.relative_to(RAIZ)}:{e.lineno}  {e.msg}"
            )


def revisar_servicios() -> None:
    """Cada 'servicio.funcion' que usa un endpoint debe existir en el servicio."""
    endpoints = APP / "api" / "v1" / "endpoints"
    servicios = APP / "services"
    if not endpoints.exists() or not servicios.exists():
        return

    for ep in sorted(endpoints.glob("*.py")):
        if ep.name == "_init_.py":
            continue
        texto = ep.read_text(encoding="utf-8", errors="ignore")
        modulo = None
        m = re.search(r"from app\.services import (\w+) as servicio", texto)
        if m:
            modulo = m.group(1)
        if modulo is None:
            continue
        destino = servicios / f"{modulo}.py"
        if not destino.exists():
            problemas.append(f"SERVICIO    falta app/services/{modulo}.py")
            continue
        definidas = {
            n.name
            for n in ast.walk(ast.parse(destino.read_text(encoding="utf-8")))
            if isinstance(n, ast.FunctionDef)
        }
        usadas = set(re.findall(r"servicio\.(\w+)", texto))
        faltan = usadas - definidas
        if faltan:
            problemas.append(
                f"FALTAN      app/services/{modulo}.py no define: {', '.join(sorted(faltan))}"
            )


def revisar_modelos_vs_sql() -> None:
    sqls = list((APP / "database").glob("*.sql"))
    if not sqls:
        return
    sql = max(sqls, key=lambda p: p.stat().st_mtime).read_text(
        encoding="utf-8", errors="ignore"
    )
    en_sql = set(re.findall(r"CREATE TABLE (\w+)", sql))
    try:
        import app.models  # noqa: F401
        from app.database.base import Base

        en_orm = set(Base.metadata.tables)
    except Exception as e:  # pragma: no cover
        avisos.append(f"MODELOS     no se pudo cargar el ORM: {type(e)._name_}: {e}")
        return
    sin_modelo = sorted(en_sql - en_orm)
    if sin_modelo:
        avisos.append(f"MODELOS     tablas en el .sql sin modelo: {', '.join(sin_modelo)}")


def main() -> int:
    revisar_nombres()
    revisar_vacios()
    revisar_dunders()
    revisar_truncados()
    revisar_servicios()
    revisar_modelos_vs_sql()

    print("=" * 66)
    if problemas:
        print(f"PROBLEMAS ({len(problemas)})")
        print("=" * 66)
        for p in problemas:
            print("  " + p)
    else:
        print("Sin problemas: los archivos estan completos y bien formados.")

    if avisos:
        print()
        print(f"AVISOS ({len(avisos)})")
        print("=" * 66)
        for a in avisos:
            print("  " + a)

    print()
    return 1 if problemas else 0


if __name__ == "__main__":
    sys.exit(main())