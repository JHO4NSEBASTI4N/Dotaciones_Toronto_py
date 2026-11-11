"""Contratos Pydantic de entrada y salida para usuario y autenticacion."""

from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UsuarioBase(BaseModel):
    nombre: str = Field(min_length=2, max_length=255)
    correo: EmailStr
    documento: Optional[str] = Field(default=None, max_length=255)
    telefono: Optional[str] = Field(default=None, max_length=255)
    direccion: Optional[str] = Field(default=None, max_length=255)


class UsuarioCrear(UsuarioBase):
    """Lo que envia el cliente al registrarse.

    Nota: no incluye `id_rol_fk`, `estado` ni `inhabilitado` a proposito:
    esos campos los decide el servidor (evita mass assignment).
    """

    password: str = Field(min_length=8, max_length=72)


class UsuarioActualizar(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=255)
    documento: Optional[str] = Field(default=None, max_length=255)
    telefono: Optional[str] = Field(default=None, max_length=255)
    direccion: Optional[str] = Field(default=None, max_length=255)


class UsuarioRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_usuario: int
    nombre: str
    correo: str
    documento: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    estado: Optional[str] = None
    id_rol_fk: Optional[int] = None


class UsuarioDetalleRespuesta(UsuarioRespuesta):
    """Ficha de un usuario con los roles que tiene activos.

    `roles_activos` se calcula (no es una columna): sale de la tabla puente
    usuario_rol mas el rol por defecto. Es lo que el administrador necesita
    ver para saber con cuales roles puede entrar esa persona.
    """

    roles_activos: list[int] = []


class CambioPasswordEntrada(BaseModel):
    """El propio usuario cambia su contrasena: tiene que saber la actual."""

    password_actual: str = Field(min_length=1, max_length=72)
    password_nueva: str = Field(min_length=8, max_length=72)


class RestablecerPasswordEntrada(BaseModel):
    """El administrador le pone una contrasena nueva a un usuario.

    No se pide la anterior: el administrador no la conoce.
    """

    password_nueva: str = Field(min_length=8, max_length=72)


class LoginEntrada(BaseModel):
    """Credenciales. `id_rol` es opcional y solo hace falta si el usuario
    tiene MAS de un rol y quiere entrar con uno distinto al de por defecto."""

    correo: EmailStr
    password: str = Field(min_length=1, max_length=72)
    id_rol: Optional[int] = Field(
        default=None,
        gt=0,
        description="Rol con el que se quiere entrar. Si se omite, se usa el de por defecto",
    )


class RolDisponible(BaseModel):
    """Un rol que el usuario puede elegir al iniciar sesion."""

    id_rol: int
    nombre_rol: Optional[str] = None
    descripcion_rol: Optional[str] = None
    es_por_defecto: bool = False


class MisRolesRespuesta(BaseModel):
    """Lo que devuelve el boton 'cambiar rol': con cuales puede entrar."""

    id_usuario: int
    nombre: str
    rol_actual: Optional[int] = None
    roles: list[RolDisponible]


class CambiarRolEntrada(BaseModel):
    id_rol: int = Field(gt=0, description="Rol con el que se quiere continuar")


class TokenSalida(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expira_en_minutos: int
    # Cual de sus roles quedo activo en este token.
    id_rol: Optional[int] = None
    nombre_rol: Optional[str] = None
