// src/pages/bodeguero/alertas.tsx
//
// Alertas de stock que genera el backend cuando un producto cae por debajo del
// mínimo. Se muestran tal cual y se cruzan con el stock actual.

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
  fecha,
} from "../../components/indicadores";
import type { AlertaStock, StockPorProducto } from "../../types";

export default function AlertasVista() {
  const { usuario } = useSesion();

  const [alertas, setAlertas] = useState<AlertaStock[]>([]);
  const [stock, setStock] = useState<StockPorProducto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("");

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const [listaAlertas, existencias] = await Promise.all([
        traerTodo((saltar, limite) => inventario.alertas(saltar, limite)),
        traerTodo((saltar, limite) => inventario.stock(saltar, limite)),
      ]);

      setAlertas(listaAlertas.items);
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

  /** Cruza cada alerta con el nombre y stock actual del producto. */
  const detalladas = useMemo(
    () =>
      alertas.map((alerta) => {
        const producto = stock.find((fila) => fila.id_producto === alerta.id_producto_fk);

        return {
          ...alerta,
          nombre: producto?.nombre ?? `Producto #${alerta.id_producto_fk ?? "—"}`,
          categoria: producto?.categoria ?? "—",
          stock_total: producto?.stock_total ?? 0,
          stock_minimo: producto?.stock_minimo ?? 0,
        };
      }),
    [alertas, stock]
  );

  const resumen = useMemo(
    () => ({
      total: detalladas.length,
      agotados: detalladas.filter((alerta) => alerta.stock_total === 0).length,
      criticos: detalladas.filter((alerta) => alerta.nivel_stock === "CRITICO").length,
      productos: new Set(detalladas.map((alerta) => alerta.id_producto_fk)).size,
    }),
    [detalladas]
  );

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return detalladas.filter((alerta) => {
      const coincideTexto =
        !texto ||
        alerta.nombre.toLowerCase().includes(texto) ||
        alerta.categoria.toLowerCase().includes(texto);

      const coincideFiltro =
        !filtro ||
        (filtro === "agotado" && alerta.stock_total === 0) ||
        (filtro === "critico" && alerta.nivel_stock === "CRITICO") ||
        (filtro === "bajo" && alerta.stock_total > 0);

      return coincideTexto && coincideFiltro;
    });
  }, [detalladas, busqueda, filtro]);

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Bodega"
        titulo="Alertas de stock"
        descripcion="Productos que bajaron de su mínimo. Cada alerta se cruza con el stock real del momento."
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
        <Indicador etiqueta="Alertas" valor={resumen.total} descripcion="Registradas por el sistema" icono={BellRing} tono="azul" cargando={cargando} />
        <Indicador etiqueta="Agotados" valor={resumen.agotados} descripcion="Sin unidades" icono={TriangleAlert} tono="rojo" cargando={cargando} />
        <Indicador etiqueta="Nivel crítico" valor={resumen.criticos} descripcion="Marcadas como CRITICO" icono={AlertTriangle} tono="ambar" cargando={cargando} />
        <Indicador etiqueta="Productos" valor={resumen.productos} descripcion="Afectados distintos" icono={Package} tono="morado" cargando={cargando} />
      </FilaIndicadores>

      <section className="dt-listado">
        <BarraListado
          titulo="Historial de alertas"
          descripcion={`${filtradas.length} de ${detalladas.length} alertas`}
          Icono={Bell}
        >
          <CajaBusqueda valor={busqueda} onCambio={setBusqueda} marcador="Producto o categoría" />

          <FiltroEstado
            valor={filtro}
            onCambio={setFiltro}
            opciones={[
              { valor: "", texto: "Todas las alertas" },
              { valor: "agotado", texto: "Agotados" },
              { valor: "critico", texto: "Nivel crítico" },
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
          <TablaCargando mensaje="Consultando alertas…" />
        ) : filtradas.length === 0 ? (
          <TablaVacia
            titulo="Sin alertas"
            mensaje="No hay productos por debajo del mínimo. La bodega está al día."
            Icono={BellRing}
          />
        ) : (
          <div className="dt-tabla-scroll">
            <table className="dt-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Nivel</th>
                  <th>Stock actual</th>
                  <th>Mínimo</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                </tr>
              </thead>

              <tbody>
                {filtradas.map((alerta) => (
                  <tr key={alerta.id_alerta}>
                    <td>
                      <div className="dt-identidad-fila">
                        <span className="dt-avatar-fila">
                          <Package size={15} />
                        </span>
                        <div>
                          <span className="dt-fila-principal">{alerta.nombre}</span>
                          <span className="dt-fila-secundaria">
                            Alerta #{alerta.id_alerta}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>{alerta.categoria}</td>
                    <td>{alerta.nivel_stock ?? "—"}</td>
                    <td>
                      <span className="dt-fila-principal">{alerta.stock_total}</span>
                    </td>
                    <td>{alerta.stock_minimo}</td>
                    <td>{fecha(alerta.fecha_alerta)}</td>

                    <td>
                      <EtiquetaEstado
                        tipo={alerta.stock_total === 0 ? "inactivo" : "pendiente"}
                        texto={alerta.stock_total === 0 ? "Agotado" : "Bajo mínimo"}
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
