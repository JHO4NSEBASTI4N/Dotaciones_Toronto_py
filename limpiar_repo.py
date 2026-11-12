"""Limpieza del repositorio de Dotaciones Toronto - version 2.

QUE HACE
--------
  1. Saca del indice de git `backend/.env`                 (NO lo borra del disco)
  2. Saca del indice de git todos los `__pycache__` / .pyc  (NO los borra del disco)
  3. Instala un `.gitignore` completo
  4. Crea `backend/.env.example` (plantilla sin datos reales)
  5. Quita del `.sql` la fila de prueba `(13, 'string', ...)`
  6. Al final te PREGUNTA si quiere hacer el commit (git push NO lo hace nunca)

DIFERENCIA CON LA VERSION 1
---------------------------
  Ya no hay que copiar el script a la raiz del repo ni escribir comandos de git
  a mano: lo pones donde quieras, lo ejecutas y el busca el repositorio solo.

COMO SE USA
-----------
      python limpiar_repo.py

  Si no encuentra el repo, le pasas la ruta:

      python limpiar_repo.py /opt/lampp/htdocs/proyectos/Dotaciones_Toronto_py

Los respaldos que deja (`*.anterior`, `*.respaldo`) quedan ignorados por git.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

# Rutas tipicas donde vive el proyecto (se prueban en orden).
RUTAS_CONOCIDAS = [
    Path.home() / "Documentos" / "Dotaciones_Toronto_py",
    Path("/opt/lampp/htdocs/proyectos/Dotaciones_Toronto_py"),
    Path("C:/xampp/htdocs/Dotaciones_Toronto_py"),
    Path("C:/xampp/htdocs/proyectos/Dotaciones_Toronto_py"),
    Path.home() / "Dotaciones_Toronto_py",
]

GITIGNORE = """\
# --- Python ---------------------------------------------------------------
__pycache__/
*.py[cod]
*.so
venv/
.venv/
env/
.pytest_cache/
.mypy_cache/
.ruff_cache/
*.egg-info/

# --- Variables de entorno -------------------------------------------------
# NUNCA se suben: llevan la SECRET_KEY y la clave de la base de datos.
# En el repo queda solo backend/.env.example (sin valores reales).
.env
.env.*
!.env.example

# --- Respaldos de la limpieza --------------------------------------------
*.anterior
*.respaldo

# --- Editores y sistema ---------------------------------------------------
.vscode/
!.vscode/extensions.json
.idea/
*.swp
.DS_Store
Thumbs.db

# --- Frontend -------------------------------------------------------------
node_modules/
dist/
dist-ssr/
*.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*
"""

ENV_EJEMPLO = """\
# ---------------------------------------------------------------------------
# Copia este archivo como `backend/.env` y pon los valores reales.
# El .env NO se sube al repositorio (esta en el .gitignore).
# ---------------------------------------------------------------------------

APP_NAME=dotacionestoronto
APP_VERSION=1.0.0

# mysql+pymysql://USUARIO:CONTRASENA@127.0.0.1:3306/dotacionestoronto
DATABASE_URL=mysql+pymysql://root:@127.0.0.1:3306/dotacionestoronto

# Genera una nueva con:
#   python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=cambia_esta_por_una_larga_y_aleatoria
ALGORITHM=HS256

# --- Facturacion electronica (DIAN) ---
DIAN_PROVEEDOR=simulado
DIAN_AMBIENTE=2
DIAN_IVA_PORCENTAJE=19
DIAN_NIT_EMISOR=900123456
DIAN_DV_EMISOR=8
DIAN_RAZON_SOCIAL=DOTACIONES TORONTO S.A.S.
DIAN_NOMBRE_COMERCIAL=Dotaciones Toronto
DIAN_DIRECCION=CL 1 # 1 - 1
DIAN_CIUDAD=Bogota D.C.
DIAN_DEPARTAMENTO=Bogota D.C.
DIAN_TELEFONO=3000000000
DIAN_CORREO=facturacion@dotacionestoronto.com
"""


def titulo(texto: str) -> None:
    print()
    print("=" * 70)
    print(texto)
    print("=" * 70)


def es_repo(ruta: Path) -> bool:
    return (ruta / ".git").exists() and (ruta / "backend").is_dir()


def buscar_repo() -> Path | None:
    """Devuelve la raiz del repositorio, o None si no la encuentra."""
    # 1) Si se paso una ruta como argumento.
    if len(sys.argv) > 1:
        candidata = Path(sys.argv[1]).expanduser().resolve()
        return candidata if es_repo(candidata) else None

    # 2) La carpeta actual y sus padres.
    actual = Path.cwd().resolve()
    for carpeta in [actual, *actual.parents]:
        if es_repo(carpeta):
            return carpeta

    # 3) Donde esta el propio script y sus padres.
    aqui = Path(__file__).resolve().parent
    for carpeta in [aqui, *aqui.parents]:
        if es_repo(carpeta):
            return carpeta

    # 4) Rutas tipicas de Fedora y Windows.
    for ruta in RUTAS_CONOCIDAS:
        if es_repo(ruta):
            return ruta

    return None


def main() -> int:
    titulo("LIMPIEZA DEL REPOSITORIO - Dotaciones Toronto")

    raiz = buscar_repo()
    if raiz is None:
        print()
        print("No encontre el repositorio.")
        print()
        print("Ejecutalo pasandole la ruta donde esta la carpeta `backend` y `.git`:")
        print()
        print("    python limpiar_repo.py /opt/lampp/htdocs/proyectos/Dotaciones_Toronto_py")
        print('    python limpiar_repo.py "C:/xampp/htdocs/Dotaciones_Toronto_py"')
        print()
        return 2

    print(f"\nRepositorio: {raiz}")

    def ejecutar(*argumentos: str):
        resultado = subprocess.run(
            argumentos, cwd=raiz, capture_output=True, text=True, shell=False
        )
        return resultado.returncode, (resultado.stdout + resultado.stderr).strip()

    codigo, version = ejecutar("git", "--version")
    if codigo != 0:
        print("\nERROR: no encuentro `git`. Abre la terminal donde si funcione.\n")
        return 2
    print(f"Git: {version}")

    cambios: list[str] = []

    # ---------------------------------------------------------------- 1
    titulo("1. Sacando backend/.env del repositorio")
    env = raiz / "backend" / ".env"
    if not env.exists():
        print("  No existe backend/.env: nada que hacer.")
    else:
        shutil.copy2(env, raiz / "backend" / ".env.respaldo")
        print("  Respaldo: backend/.env.respaldo")
        codigo, salida = ejecutar("git", "rm", "--cached", "backend/.env")
        if codigo == 0:
            print("  OK: fuera del indice de git. El archivo sigue en tu disco.")
            cambios.append("backend/.env fuera del repositorio")
        else:
            print(f"  AVISO: git dijo: {salida}")

    # ---------------------------------------------------------------- 2
    titulo("2. Sacando los .pyc / __pycache__ del repositorio")
    codigo, salida = ejecutar("git", "ls-files")
    if codigo != 0:
        print(f"  ERROR al listar archivos: {salida}")
        return 3

    basura = [
        linea.strip()
        for linea in salida.splitlines()
        if "__pycache__" in linea or linea.strip().endswith((".pyc", ".pyo"))
    ]

    if not basura:
        print("  No hay .pyc versionados: nada que hacer.")
    else:
        print(f"  Encontrados {len(basura)} archivos. Sacandolos del indice...")
        LOTE = 40  # en Windows la linea de comandos tiene limite de largo
        fallos = 0
        for i in range(0, len(basura), LOTE):
            codigo, _ = ejecutar("git", "rm", "--cached", "--quiet", *basura[i : i + LOTE])
            if codigo != 0:
                fallos += 1
        if fallos == 0:
            print(f"  OK: {len(basura)} archivos fuera del indice.")
            cambios.append(f"{len(basura)} archivos .pyc fuera del repositorio")
        else:
            print(f"  AVISO: {fallos} lote(s) fallaron. Revisa `git status`.")

    # ---------------------------------------------------------------- 3
    titulo("3. Instalando el .gitignore")
    destino = raiz / ".gitignore"
    if destino.exists():
        shutil.copy2(destino, raiz / ".gitignore.anterior")
        print("  Respaldo: .gitignore.anterior")
    destino.write_text(GITIGNORE, encoding="utf-8")
    print("  OK: .gitignore completo (incluye .env, .pyc, node_modules, dist).")
    cambios.append(".gitignore completo")

    # ---------------------------------------------------------------- 4
    titulo("4. Creando backend/.env.example")
    (raiz / "backend" / ".env.example").write_text(ENV_EJEMPLO, encoding="utf-8")
    print("  OK: plantilla creada, sin datos reales.")
    cambios.append("backend/.env.example creado")

    # ---------------------------------------------------------------- 5
    titulo("5. Quitando la fila (13, 'string', ...) del .sql")
    ruta_sql = raiz / "backend" / "app" / "database" / "dotacionestoronto.sql"
    if limpiar_sql(ruta_sql):
        cambios.append("dotacionestoronto.sql sin la fila de prueba")

    # ---------------------------------------------------------------- 6
    titulo("RESUMEN")
    for cambio in cambios or ["No se cambio nada"]:
        print(f"  - {cambio}")

    print()
    print("Revisa lo que git ve ahora:")
    print()
    print("    git status")
    print()

    # ---------------------------------------------------------------- 7
    # Commit opcional. NUNCA hace push.
    respuesta = input("¿Hago el commit con estos cambios? (s/n): ").strip().lower()
    if respuesta == "s":
        ejecutar("git", "add", "-A")
        codigo, salida = ejecutar(
            "git",
            "commit",
            "-m",
            "limpieza: .env y .pyc fuera del repo, sql sin fila de prueba",
        )
        print()
        if codigo == 0:
            print("  OK: commit hecho. Todavia NO se ha subido nada.")
            print()
            print("  Para subirlo tu, cuando quieras:")
            print("      git push")
        else:
            print(f"  AVISO: git dijo: {salida}")
    else:
        print()
        print("  No se hizo commit. Cuando quieras:")
        print('      git add -A && git commit -m "limpieza: .env y .pyc fuera del repo, sql sin fila de prueba"')

    print()
    print("IMPORTANTE: cambia la SECRET_KEY del backend/.env")
    print("(la que estuvo en el repo hay que darla por comprometida).")
    print("Genera una nueva con:")
    print()
    print('    python -c "import secrets; print(secrets.token_hex(32))"')
    print()

    # ---------------------------------------------------------------- 8
    try:
        Path(__file__).unlink()
        print("(Este script se borro solo: no hace falta que lo subas.)")
    except OSError:
        print("(Borra este script a mano: no hace falta que lo subas.)")

    print()
    return 0


def limpiar_sql(ruta: Path) -> bool:
    """Quita la fila (13, 'string', ...) y vuelve a cerrar bien el INSERT.

    Se trabaja linea por linea a proposito: si se borra la fila con una
    expresion regular, es facil comerse un parentesis o dejar una coma suelta,
    y el .sql queda invalido (MySQL no importa nada y el error no dice donde).
    """
    if not ruta.exists():
        print("  No encontre el .sql: se salta este paso.")
        return False

    original = ruta.read_text(encoding="utf-8", errors="ignore")

    if "'string'" not in original:
        print("  El .sql ya estaba limpio: nada que hacer.")
        return False

    lineas = original.split("\n")

    # 1) Se ubica el INSERT INTO `producto`.
    inicio = next(
        (i for i, l in enumerate(lineas) if l.startswith("INSERT INTO `producto`")),
        None,
    )
    if inicio is None:
        print("  AVISO: no encontre el INSERT INTO producto. No toco nada.")
        return False

    # 2) Se quita la fila de prueba.
    antes = len(lineas)
    lineas = [l for l in lineas if not l.startswith("(13, 'string', 1.00, 'string'")]
    if len(lineas) == antes:
        print("  AVISO: no pude quitar la fila. Revisala a mano.")
        return False

    # 3) Se vuelve a cerrar el INSERT: la ultima fila termina en ';' y las
    #    demas en ','. El INSERT acaba en la primera linea que ya trae ';'.
    inicio = next(
        i for i, l in enumerate(lineas) if l.startswith("INSERT INTO `producto`")
    )
    fin = next(i for i in range(inicio, len(lineas)) if lineas[i].rstrip().endswith(";"))

    filas = [i for i in range(inicio + 1, fin) if lineas[i].startswith("(")]
    if not filas:
        print("  AVISO: no pude identificar las filas del INSERT. Revisalo a mano.")
        return False

    for i in filas[:-1]:
        if not lineas[i].rstrip().endswith(","):
            lineas[i] = lineas[i].rstrip().rstrip(";") + ","
    lineas[filas[-1]] = lineas[filas[-1]].rstrip().rstrip(",;") + ";"

    texto = "\n".join(lineas)

    shutil.copy2(ruta, ruta.with_suffix(".sql.anterior"))
    ruta.write_text(texto, encoding="utf-8")

    # 4) Comprobaciones: sin 'string', sin comas sueltas y con el INSERT cerrado.
    if "'string'" in texto:
        print("  AVISO: todavia aparece 'string'. Revisalo a mano.")
        return False

    bloque = re.search(r"INSERT INTO `producto`.*?;\s*\n", texto, re.S)
    if bloque is None or re.search(r",\s*;", bloque.group(0)):
        print("  AVISO: el INSERT de producto quedo mal cerrado. Revisalo a mano.")
        return False

    print("  OK: fila borrada y el INSERT de producto cierra con ';'.")
    print(f"  Quedan {len(filas)} productos (del 6 al 12).")
    print("  Respaldo: dotacionestoronto.sql.anterior")
    return True


if __name__ == "__main__":
    sys.exit(main())
