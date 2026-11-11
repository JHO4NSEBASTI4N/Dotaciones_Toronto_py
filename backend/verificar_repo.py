"""Verificador del repo: detecta los errores tipicos al subir codigo a mano.

Uso (desde la carpeta backend/):

    python verificar_repo.py

Revisa 7 cosas:
  1. Nombres de archivo que no coinciden con el import: si un modulo hace
     `from app.models.factura_electronica import X` pero el archivo se llama
     `facturacion_electronica.py`, Python no lo encuentra y el backend NO
     ARRANCA ("ModuleNotFoundError"). Esta revision compara los dos nombres.
  1b. Nombres estropeados por Markdown: archivos llamados `_init_.py`
     (un solo guion bajo) en vez de `__init__.py`
  2. Archivos .py vacios (0 bytes)  -> GitHub creo la ruta pero sin contenido
     (los `__init__.py` vacios NO cuentan: son correctos, son solo marcadores)
  3. Dunders destruidos por Markdown (`_tablename_` en vez de `__tablename__`)
  4. Archivos truncados (terminan a mitad de una funcion)
  4. Funciones que los endpoints llaman y no existen en el servicio
  5. Tablas del .sql sin modelo en el ORM

No modifica nada: solo informa.
"""

from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
APP = RAIZ / "app"

# roto -> correcto
DUNDERS = {
    "__init__": "__init__",
    "__tablename__": "__tablename__",
    "__all__": "__all__",
    "__repr__": "__repr__",
    "__str__": "__str__",
}

problemas: list[str] = []
avisos: list[str] = []


# Nombres que Markdown dejo a medio comer, con el nombre que deberia tener.
NOMBRES_ROTOS = {
    "__init__.py": "__init__.py",
    "__main__.py": "__main__.py",
    "_tablename_.py": None,
}


def revisar_nombres() -> None:
    """Archivos cuyo NOMBRE quedo mal (Markdown se comio los guiones bajos).

    Un archivo llamado `_init_.py` no sirve para nada: Python no lo reconoce
    como inicializador del paquete. Ahi esta el error, no en que este vacio.
    """
    for archivo in sorted(APP.rglob("*.py")):
        if "__pycache__" in archivo.parts:
            continue
        correcto = NOMBRES_ROTOS.get(archivo.name)
        if correcto:
            problemas.append(
                f"NOMBRE      {archivo.relative_to(RAIZ)}  "
                f"deberia llamarse '{correcto}' (no '{archivo.name}')"
            )


def revisar_nombres_import() -> None:
    """Compara cada `from app.<paquete> import <modulo>` con los archivos reales.

    Es el error mas caro de los que se cometen subiendo archivos a mano: el
    contenido esta perfecto, pero el archivo se llama distinto y el backend
    entero deja de arrancar con un ModuleNotFoundError. Aqui se avisa ANTES de
    correr nada, con el nombre que se esperaba y el parecido que si existe.

    Se usa `ast` (el arbol de Python) en vez de expresiones regulares: asi se
    entienden los `import ... as ...`, los imports entre parentesis y las
    clases, sin falsos positivos.
    """
    if not APP.exists():
        return

    for archivo in sorted(APP.rglob("*.py")):
        if "__pycache__" in archivo.parts:
            continue

        try:
            arbol = ast.parse(archivo.read_text(encoding="utf-8", errors="ignore"))
        except SyntaxError:
            continue  # de los archivos rotos ya se encarga revisar_truncados()

        for nodo in ast.walk(arbol):
            if not isinstance(nodo, ast.ImportFrom):
                continue
            if not nodo.module or not nodo.module.startswith("app"):
                continue

            ruta_paquete = RAIZ / nodo.module.replace(".", "/")

            # Caso A: el modulo importado NO es una carpeta sino un archivo
            # (ej. `from app.models.factura_electronica import FacturaElectronica`).
            # Si ese archivo no existe con ese nombre exacto, el backend no
            # arranca. Es el error tipico al subir archivos a mano.
            if not ruta_paquete.is_dir():
                carpeta = ruta_paquete.parent
                archivo_esperado = ruta_paquete.name + ".py"
                if not (carpeta / archivo_esperado).exists():
                    parecidos = sorted(
                        f.name
                        for f in carpeta.glob("*.py")
                        if _distancia(ruta_paquete.name, f.stem) <= 4
                    )
                    pista = (
                        f"  -> quizas el archivo se llama '{parecidos[0]}'"
                        if parecidos
                        else ""
                    )
                    problemas.append(
                        f"IMPORT      {archivo.relative_to(RAIZ)}: "
                        f"'{nodo.module}' no existe{pista}"
                    )
                continue

            # Lo que el __init__ del paquete ya expone (funciones, constantes).
            expuestos = set()
            init = ruta_paquete / "__init__.py"
            if init.exists():
                try:
                    arbol_init = ast.parse(init.read_text(encoding="utf-8", errors="ignore"))
                    for sub in ast.walk(arbol_init):
                        if isinstance(sub, ast.ImportFrom):
                            expuestos.update(a.name for a in sub.names)
                        elif isinstance(sub, (ast.FunctionDef, ast.ClassDef)):
                            expuestos.add(sub.name)
                        elif isinstance(sub, (ast.Assign, ast.AnnAssign)):
                            destinos = getattr(sub, "targets", [getattr(sub, "target", None)])
                            for destino in destinos:
                                if isinstance(destino, ast.Name):
                                    expuestos.add(destino.id)
                except SyntaxError:
                    pass

            for alias in nodo.names:
                nombre = alias.name

                # Se saltan clases y funciones (empiezan en mayuscula o ya
                # estan definidas en el __init__ del paquete).
                if nombre[0].isupper() or nombre in expuestos:
                    continue

                if (ruta_paquete / f"{nombre}.py").exists():
                    continue
                if (ruta_paquete / nombre).is_dir():
                    continue

                parecidos = sorted(
                    f.stem
                    for f in ruta_paquete.glob("*.py")
                    if f.stem != "__init__" and _distancia(nombre, f.stem) <= 4
                )
                pista = (
                    f"  -> quizas el archivo se llama '{parecidos[0]}.py'"
                    if parecidos
                    else ""
                )
                problemas.append(
                    f"IMPORT      {archivo.relative_to(RAIZ)}: "
                    f"'{nodo.module}.{nombre}' no existe{pista}"
                )


def _distancia(a: str, b: str) -> int:
    """Distancia de edicion (Levenshtein), para detectar nombres casi iguales."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)

    anterior = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        actual = [i]
        for j, cb in enumerate(b, 1):
            actual.append(
                min(
                    anterior[j] + 1,
                    actual[j - 1] + 1,
                    anterior[j - 1] + (ca != cb),
                )
            )
        anterior = actual
    return anterior[-1]


def revisar_vacios() -> None:
    for archivo in sorted(APP.rglob("*.py")):
        if "__pycache__" in archivo.parts:
            continue
        if archivo.name in NOMBRES_ROTOS:
            continue  # ya se reporta como NOMBRE, no como VACIO
        # Un __init__.py vacio es lo normal: solo marca que la carpeta es un
        # paquete de Python. No es un error.
        if archivo.stat().st_size == 0 and archivo.name != "__init__.py":
            problemas.append(f"VACIO       {archivo.relative_to(RAIZ)}")


def revisar_dunders() -> None:
    for archivo in sorted(APP.rglob("*.py")):
        if "__pycache__" in archivo.parts:
            continue
        texto = archivo.read_text(encoding="utf-8", errors="ignore")
        for i, linea in enumerate(texto.splitlines(), 1):
            for roto, correcto in DUNDERS.items():
                # exactamente un guion bajo a cada lado
                if re.search(rf"(?<!_){re.escape(roto)}(?!_)", linea):
                    problemas.append(
                        f"DUNDER      {archivo.relative_to(RAIZ)}:{i}  "
                        f"'{roto}' deberia ser '{correcto}'"
                        "  (Markdown se comio los guiones bajos)"
                    )
                    break


def revisar_truncados() -> None:
    for archivo in sorted(APP.rglob("*.py")):
        if "__pycache__" in archivo.parts:
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
        if ep.name == "__init__.py":
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


def revisar_routers_registrados() -> None:
    """Avisa si un modulo de endpoints existe pero no esta en `api.py`.

    Paso con el modulo de usuarios: los archivos estaban subidos y correctos,
    pero faltaba la linea que registra el router, asi que sus 6 endpoints no
    existian para el cliente. El backend arrancaba sin error: nadie se daba
    cuenta hasta entrar a /docs.
    """
    endpoints = APP / "api" / "v1" / "endpoints"
    api_py = APP / "api" / "v1" / "api.py"
    if not endpoints.is_dir() or not api_py.exists():
        return

    texto_api = api_py.read_text(encoding="utf-8", errors="ignore")

    for modulo in sorted(endpoints.glob("*.py")):
        if modulo.name == "__init__.py":
            continue
        nombre = modulo.stem
        if f"{nombre}.router" not in texto_api:
            problemas.append(
                f"ROUTER      app/api/v1/endpoints/{nombre}.py existe pero NO "
                "esta registrado en app/api/v1/api.py (sus rutas no existen)"
            )


def revisar_modelos_vs_sql() -> None:
    sqls = list((APP / "database").glob("*.sql"))
    if not sqls:
        return
    sql = max(sqls, key=lambda p: p.stat().st_mtime).read_text(
        encoding="utf-8", errors="ignore"
    )
    en_sql = set(re.findall(r"CREATE TABLE `(\w+)`", sql))
    try:
        import app.models  # noqa: F401
        from app.database.base import Base

        en_orm = set(Base.metadata.tables)
    except Exception as e:  # pragma: no cover
        avisos.append(f"MODELOS     no se pudo cargar el ORM: {type(e).__name__}: {e}")
        return
    sin_modelo = sorted(en_sql - en_orm)
    if sin_modelo:
        avisos.append(f"MODELOS     tablas en el .sql sin modelo: {', '.join(sin_modelo)}")


def main() -> int:
    revisar_nombres()
    revisar_nombres_import()
    revisar_vacios()
    revisar_dunders()
    revisar_truncados()
    revisar_servicios()
    revisar_routers_registrados()
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
