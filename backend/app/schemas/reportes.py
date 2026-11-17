"""Esquemas validados para exportar reportes administrativos."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator


ModuloReporte = Literal[
    "panel",
    "productos",
    "pedidos",
    "ventas",
    "devoluciones",
    "inventario",
    "usuarios",
    "facturacion",
]


class ColumnaReporte(BaseModel):
    clave: str = Field(min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_]+$")
    titulo: str = Field(min_length=1, max_length=80)


class IndicadorReporte(BaseModel):
    etiqueta: str = Field(min_length=1, max_length=60)
    valor: str = Field(max_length=80)


class SerieGraficaReporte(BaseModel):
    nombre: str = Field(min_length=1, max_length=60)
    valores: list[float] = Field(max_length=24)


class GraficaReporte(BaseModel):
    titulo: str = Field(min_length=1, max_length=120)
    tipo: Literal["columna", "linea"] = "columna"
    categorias: list[str] = Field(min_length=1, max_length=24)
    series: list[SerieGraficaReporte] = Field(min_length=1, max_length=4)

    @model_validator(mode="after")
    def validar_longitud_series(self):
        if any(len(serie.valores) != len(self.categorias) for serie in self.series):
            raise ValueError("Cada serie debe tener un valor por categoría")
        return self


class ReporteAdminEntrada(BaseModel):
    modulo: ModuloReporte
    titulo: str = Field(min_length=1, max_length=120)
    generado_por: str = Field(default="Administrador", max_length=120)
    indicadores: list[IndicadorReporte] = Field(default_factory=list, max_length=6)
    columnas: list[ColumnaReporte] = Field(min_length=1, max_length=16)
    filas: list[dict[str, str | int | float | bool | None]] = Field(max_length=5000)
    grafica: GraficaReporte

    @model_validator(mode="after")
    def validar_filas(self):
        claves = {columna.clave for columna in self.columnas}
        if len(claves) != len(self.columnas):
            raise ValueError("Las columnas del reporte no pueden repetirse")
        if any(set(fila) - claves for fila in self.filas):
            raise ValueError("Cada dato de fila debe corresponder a una columna declarada")
        return self
