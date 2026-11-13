// Alertas activas construidas desde el stock actual, no desde el historial.
// El historial puede no contener alertas para inventarios creados antes de esta corrección.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, BellRing, Package, RefreshCw, TriangleAlert } from "../../components/iconos";

import { inventario, traerTodo } from "../../services/api";
import { useSesion } from "../../context/sesion-contexto";
import {
  Aviso,
  BarraListado,
  CajaBusqueda,
  EncabezadoModulo,
  EtiquetaEstado,
  FiltroEstado,
  FilaIndicadores,
  Indicador,
  TablaCargando,
  TablaVacia,
} from "../../components/indicadores";
import type { StockPorProducto } from "../../types";

export default function AlertasVista() {
  const { usuario } = useSesion();

  const [stock, setStock] = useState<StockPorProducto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("");

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const existencias = await traerTodo((saltar, limite) => inventario.stock(saltar, limite));
      setStock(existencias.items);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudieron cargar las alertas.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const alertas = useMemo(
    () => stock.filter((fila) => !fila.inhabilitado && fila.bajo_minimo),
    [stock]
  );

  const resumen = useMemo(
    () => ({
      total: alertas.length,
      agotados: alertas.filter((fila) => fila.stock_total === 0).length,
      conStock: alertas.filter((fila) => fila.stock_total > 0).length,
    }),
    [alertas]
  );

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return alertas.filter((fila) => {
      const coincideTexto =
        !texto ||
        fila.nombre.toLowerCase().includes(texto) ||
        (fila.categoria ?? "").toLowerCase().includes(texto);

      const coincideFiltro =
        !filtro ||
        (filtro === "agotado" && fila.stock_total === 0) ||
        (filtro === "bajo" && fila.stock_total > 0);

      return coincideTexto && coincideFiltro;
    });
  }, [alertas, busqueda, filtro]);

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Bodega"
        titulo="Alertas de stock"
        descripcion="Productos cuyo stock actual está en o por debajo del mínimo configurado."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "bodeguero" } : undefined}
        accion={
          <button
            type="button"
            className="dt-accion-principal"
            onClick={() => void cargarDatos()}
            disabled={cargando}
          >
            <RefreshCw size={15} className={cargando ? "dt-girando" : ""} />
            Actualizar
          </button>
        }
      />

      {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}

      <FilaIndicadores>
        <Indicador etiqueta="Bajo mínimo" valor={resumen.total} descripcion="Alertas activas ahora" icono={BellRing} tono="azul" cargando={cargando} />
        <Indicador etiqueta="Agotados" valor={resumen.agotados} descripcion="Sin unidades disponibles" icono={TriangleAlert} tono="rojo" cargando={cargando} />
        <Indicador etiqueta="Con existencias" valor={resumen.conStock} descripcion="Pero bajo el mínimo" icono={AlertTriangle} tono="ambar" cargando={cargando} />
        <Indicador etiqueta="Productos" valor={resumen.total} descripcion="Productos afectados" icono={Package} tono="morado" cargando={cargando} />
      </FilaIndicadores>

      <section className="dt-listado">
        <BarraListado
          titulo="Alertas activas"
          descripcion={`${filtradas.length} de ${alertas.length} productos`}
          Icono={Bell}
        >
          <CajaBusqueda valor={busqueda} onCambio={setBusqueda} marcador="Producto o categoría" />

          <FiltroEstado
            valor={filtro}
            onCambio={setFiltro}
            opciones={[
              { valor: "", texto: "Todas las alertas" },
              { valor: "agotado", texto: "Agotados" },
              { valor: "bajo", texto: "Con algo de stock" },
            ]}
          />

          <button
            type="button"
            className="dt-boton-icono"
            onClick={() => void cargarDatos()}
            disabled={cargando}
            title="Refrescar"
          >
            <RefreshCw size={15} className={cargando ? "dt-girando" : ""} />
          </button>
        </BarraListado>

        {cargando ? (
          <TablaCargando mensaje="Consultando stock actual…" />
        ) : filtradas.length === 0 ? (
          <TablaVacia
            titulo="Sin alertas activas"
            mensaje="No hay productos activos en o por debajo de su stock mínimo."
            Icono={BellRing}
          />
        ) : (
          <div className="dt-tabla-scroll">
            <table className="dt-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Stock actual</th>
                  <th>Mínimo</th>
                  <th>Estado</th>
                </tr>
              </thead>

              <tbody>
                {filtradas.map((fila) => (
                  <tr key={fila.id_producto}>
                    <td>
                      <div className="dt-identidad-fila">
                        <span className="dt-avatar-fila">
                          <Package size={15} />
                        </span>
                        <div>
                          <span className="dt-fila-principal">{fila.nombre}</span>
                          <span className="dt-fila-secundaria">Producto #{fila.id_producto}</span>
                        </div>
                      </div>
                    </td>
                    <td>{fila.categoria ?? "—"}</td>
                    <td><span className="dt-fila-principal">{fila.stock_total}</span></td>
                    <td>{fila.stock_minimo}</td>
                    <td>
                      <EtiquetaEstado
                        tipo={fila.stock_total === 0 ? "inactivo" : "pendiente"}
                        texto={fila.stock_total === 0 ? "Agotado" : "Bajo mínimo"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
