from app.core.security import hashear_password, verificar_password


# --- unidad: seguridad -------------------------------------------------------

def test_hash_no_es_texto_plano():
    hash_generado = hashear_password("secreta123")
    assert hash_generado != "secreta123"
    assert hash_generado.startswith("$2b$")


def test_verificar_password_correcta():
    assert verificar_password("secreta123", hashear_password("secreta123")) is True


def test_verificar_password_incorrecta():
    assert verificar_password("otra", hashear_password("secreta123")) is False


def test_verificar_hash_corrupto_no_explota():
    assert verificar_password("secreta123", "no-es-un-hash") is False


# --- estado ------------------------------------------------------------------

def test_raiz_responde(cliente):
    respuesta = cliente.get("/")
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "API Funcionando"


# --- registro ----------------------------------------------------------------

def test_registro_crea_usuario(cliente):
    respuesta = cliente.post(
        "/api/v1/auth/registro",
        json={"nombre": "Ana", "correo": "ana@toronto.com", "password": "secreta123"},
    )
    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["correo"] == "ana@toronto.com"
    assert cuerpo["estado"] == "Habilitado"


def test_registro_no_devuelve_password(cliente):
    respuesta = cliente.post(
        "/api/v1/auth/registro",
        json={"nombre": "Ana", "correo": "ana@toronto.com", "password": "secreta123"},
    )
    assert "password" not in respuesta.json()


def test_registro_correo_duplicado_da_409(cliente, usuario_registrado):
    respuesta = cliente.post(
        "/api/v1/auth/registro",
        json={
            "nombre": "Otro",
            "correo": usuario_registrado["correo"],
            "password": "secreta123",
        },
    )
    assert respuesta.status_code == 409
    assert respuesta.json()["error"] == "Conflicto"


def test_registro_correo_invalido_da_422(cliente):
    respuesta = cliente.post(
        "/api/v1/auth/registro",
        json={"nombre": "X", "correo": "no-es-correo", "password": "secreta123"},
    )
    assert respuesta.status_code == 422


def test_registro_password_corta_da_422(cliente):
    respuesta = cliente.post(
        "/api/v1/auth/registro",
        json={"nombre": "X", "correo": "x@toronto.com", "password": "123"},
    )
    assert respuesta.status_code == 422


# --- login -------------------------------------------------------------------

def test_login_correcto_devuelve_token(cliente, usuario_registrado):
    respuesta = cliente.post(
        "/api/v1/auth/login",
        json={
            "correo": usuario_registrado["correo"],
            "password": usuario_registrado["password"],
        },
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["token_type"] == "bearer"
    assert respuesta.json()["access_token"]


def test_login_password_incorrecta_da_401(cliente, usuario_registrado):
    respuesta = cliente.post(
        "/api/v1/auth/login",
        json={"correo": usuario_registrado["correo"], "password": "incorrecta"},
    )
    assert respuesta.status_code == 401


def test_login_correo_inexistente_da_401(cliente):
    respuesta = cliente.post(
        "/api/v1/auth/login",
        json={"correo": "nadie@toronto.com", "password": "secreta123"},
    )
    assert respuesta.status_code == 401


def test_login_usuario_inhabilitado_da_403(cliente, usuario_registrado, sesion):
    from app.models.usuario import Usuario

    usuario = sesion.get(Usuario, usuario_registrado["id_usuario"])
    usuario.estado = "Inhabilitado"
    sesion.commit()

    respuesta = cliente.post(
        "/api/v1/auth/login",
        json={
            "correo": usuario_registrado["correo"],
            "password": usuario_registrado["password"],
        },
    )
    assert respuesta.status_code == 403


# --- perfil protegido --------------------------------------------------------

def test_perfil_sin_token_da_401(cliente):
    assert cliente.get("/api/v1/auth/yo").status_code == 401


def test_perfil_con_token(cliente, token, usuario_registrado):
    respuesta = cliente.get(
        "/api/v1/auth/yo", headers={"Authorization": f"Bearer {token}"}
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["correo"] == usuario_registrado["correo"]


def test_perfil_token_invalido_da_401(cliente):
    respuesta = cliente.get(
        "/api/v1/auth/yo", headers={"Authorization": "Bearer token.falso.aqui"}
    )
    assert respuesta.status_code == 401


# --- compatibilidad OAuth2 /docs ---------------------------------------------

def test_token_por_formulario(cliente, usuario_registrado):
    respuesta = cliente.post(
        "/api/v1/auth/token",
        data={
            "username": usuario_registrado["correo"],
            "password": usuario_registrado["password"],
        },
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["access_token"]


# --- /token debe tolerar un username que no es correo ------------------------
# Regresion: antes devolvia 500 porque ValidationError no se capturaba.

def test_token_username_que_no_es_correo_da_401(cliente):
    respuesta = cliente.post(
        "/api/v1/auth/token", data={"username": "jhoan", "password": "secreta123"}
    )
    assert respuesta.status_code == 401


def test_token_password_vacia_da_401(cliente, usuario_registrado):
    respuesta = cliente.post(
        "/api/v1/auth/token",
        data={"username": usuario_registrado["correo"], "password": " "},
    )
    assert respuesta.status_code in (401, 422)